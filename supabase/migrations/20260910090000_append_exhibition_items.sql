begin;

-- Check under the same lock as constraint creation; never renumber existing rows.
lock table public.exhibition_items in share row exclusive mode;
do $$
declare v_duplicates text;
begin
  select string_agg(format('(%s, %s): %s rows', exhibition_id, item_no, n), '; ')
  into v_duplicates
  from (
    select exhibition_id, item_no, count(*) n
    from public.exhibition_items
    where exhibition_id is not null and item_no is not null
    group by exhibition_id, item_no having count(*) > 1
    order by exhibition_id, item_no limit 20
  ) d;
  if v_duplicates is not null then
    raise exception 'Duplicate exhibition item numbers; migration stopped. %', v_duplicates;
  end if;
end $$;

alter table public.exhibition_items
  add constraint exhibition_items_exhibition_item_no_key unique (exhibition_id, item_no);

create function public.append_exhibition_items(p_exhibition_id text, p_shop_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_exhibition public.exhibitions%rowtype;
  v_item public.exhibition_items%rowtype;
  v_json jsonb;
  v_next bigint;
  v_first bigint;
  v_count integer := 0;
  v_row integer;
  v_reason text;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = '取込対象の商品がありません。';
  end if;
  -- Serializes append imports for this exhibition without changing its settings.
  select * into v_exhibition from public.exhibitions
  where id = (jsonb_populate_record(null::public.exhibitions, jsonb_build_object('id', p_exhibition_id))).id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = '追加先の展示会が見つかりません。';
  end if;
  select coalesce(max(item_no), 0)::bigint + 1 into v_next
  from public.exhibition_items where exhibition_id = v_exhibition.id;
  v_first := v_next;

  for v_json in select value from jsonb_array_elements(p_items)
  loop
    v_row := (v_json->>'_excel_row')::integer;
    begin
      v_item := jsonb_populate_record(null::public.exhibition_items, v_json);
      insert into public.exhibition_items (
        exhibition_id, shop_id, item_no, product_name, category, item, variety,
        tree_height, tree_shape, pot_size, irisu, quantity, price, sales_unit,
        units_per_sales_unit, origin, producer, comment, jf_code, staff,
        status, input_completed, published, published_at,
        reservation_period_enabled, reservation_start_date, reservation_end_date,
        sales_period_enabled, sales_start_date, sales_end_date
      ) values (
        v_exhibition.id, p_shop_id, v_next, v_item.product_name, v_item.category,
        v_item.item, v_item.variety, v_item.tree_height, v_item.tree_shape,
        v_item.pot_size, v_item.irisu, v_item.quantity, v_item.price,
        v_item.sales_unit, v_item.units_per_sales_unit, v_item.origin,
        v_item.producer, v_item.comment, v_item.jf_code, v_item.staff,
        'preparing', false, false, null,
        v_item.reservation_period_enabled, v_item.reservation_start_date,
        v_item.reservation_end_date, v_item.sales_period_enabled,
        v_item.sales_start_date, v_item.sales_end_date
      );
    exception when others then
      v_reason := case sqlstate
        when '23505' then '商品番号が別の登録と重複しました。再度取り込んでください'
        when '23503' then '参照先の展示会またはショップが見つかりません'
        when '23502' then '必須項目が不足しています'
        when '23514' then '商品情報がDBの入力条件を満たしていません'
        when '22003' then '数値が保存可能な範囲を超えています'
        else '商品情報を保存できませんでした'
      end;
      raise exception using errcode = sqlstate,
        message = format('%s行目：%s。追加分は保存されていません。', v_row, v_reason);
    end;
    v_next := v_next + 1;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('exhibitionName', v_exhibition.name, 'itemCount', v_count, 'firstItemNo', v_first, 'lastItemNo', v_next - 1);
end;
$$;

-- The server checks canManageShop before invoking this RPC. No browser execution.
revoke all on function public.append_exhibition_items(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.append_exhibition_items(text, uuid, jsonb) to service_role;

commit;
