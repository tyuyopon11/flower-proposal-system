import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.IMPORT_TEST_ROOT || path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'package.json'));
const ts = req('typescript');
const XLSX = req('xlsx');
const {NextRequest} = req('next/server');
const headers = ['商品番号','商品名','カテゴリー','品目','品種','樹高','樹形','鉢サイズ','入数','数量（ケース数）','価格','産地','生産者','コメント','JFコード'];
const periods = ['受付開始日','受付終了日','販売開始日','販売終了日'];
const product = [1,'検証商品','観葉植物','品目','品種','180cm','曲がり','10号',6,2,38000,'愛知','生産者','コメント','001234'];
const disabled = {reservation_period_enabled:false,reservation_start_date:null,reservation_end_date:null,sales_period_enabled:false,sales_start_date:null,sales_end_date:null};
const expectedProduct = {item_no:1,product_name:'検証商品',category:'観葉植物',item:'品目',variety:'品種',tree_height:'180cm',tree_shape:'曲がり',pot_size:'10号',irisu:6,quantity:2,price:38000,sales_unit:'case',units_per_sales_unit:6,origin:'愛知',producer:'生産者',comment:'コメント',jf_code:'001234',staff:null,status:'preparing',input_completed:false,shop_id:'shop-test',exhibition_id:'exhibition-test'};

// Compile the real route and real period helpers; mock only authentication and DB I/O.
function loadRoute(allowed=true) {
  const writes=[];
  const db={from(table){
    const chain={select(){return chain},eq(){return chain},maybeSingle:async()=>({data:{id:'shop-test',shop_name:'検証店'},error:null}),single:async()=>({data:{id:'exhibition-test'},error:null}),
      insert(data){writes.push({table,operation:'insert',data});return chain},update(data){writes.push({table,operation:'update',data});return chain},delete(){writes.push({table,operation:'delete'});return chain},
      then(resolve,reject){return Promise.resolve({error:null}).then(resolve,reject)}};
    return chain;
  }};
  const cache=new Map();
  function load(file) {
    if(cache.has(file)) return cache.get(file);
    const exports={}; cache.set(file,exports);
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const localRequire=(id)=>{
      if(id==='@/lib/supabaseAdmin')return {supabaseAdmin:db};
      if(id==='@/lib/auth/shop-access')return {canManageShop:async()=>allowed};
      if(id.startsWith('@/')){
        assert.match(id,/^@\/lib\/products\//,'Unexpected production module must not load');
        const relative=id.slice(2)+'.ts';
        return load([path.join(root,'src',relative),path.join(root,relative)].find(fs.existsSync));
      }
      assert.ok(['next/server','xlsx'].includes(id),`Unexpected module: ${id}`);
      return req(id);
    };
    new Function('require','exports',code)(localRequire,exports);
    return exports;
  }
  return {POST:load(path.join(root,'app/api/admin/exhibition/import/route.ts')).POST,writes};
}
function workbook(dates=[],old=false,secondRow) {
  const wb=XLSX.utils.book_new();
  const settings=XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(settings,[['検証展示会'],['2026-01-01'],['2026-12-31'],['植物'],['検証店']],{origin:'B4'});
  const sheet=XLSX.utils.aoa_to_sheet([[],[],old?headers:[...headers,...periods],[...product,...dates]]);
  if(secondRow) XLSX.utils.sheet_add_aoa(sheet,[[2,...product.slice(1),...secondRow]],{origin:'A5'});
  XLSX.utils.book_append_sheet(wb,settings,'展示会設定');XLSX.utils.book_append_sheet(wb,sheet,'商品リスト');return wb;
}
async function run(wb,allowed=true) {
  const {POST,writes}=loadRoute(allowed);
  const data=new FormData();data.set('file',new File([XLSX.write(wb,{type:'buffer',bookType:'xlsx'})],'import.xlsx'));
  const response=await POST(new NextRequest('http://localhost/api/admin/exhibition/import',{method:'POST',body:data}));
  return {status:response.status,body:await response.json(),writes,rows:writes.find(w=>w.table==='exhibition_items')?.data};
}
test('正式テンプレートのA〜O列と追加P〜S列',()=>{
  const wb=XLSX.readFile(path.join(root,'public/templates/LeiPort_Import_Template_v1.1.xlsx'));
  const sheet=wb.Sheets['商品リスト'];
  assert.deepEqual(Array.from({length:19},(_,i)=>sheet[XLSX.utils.encode_col(i)+'3']?.v),[...headers,...periods]);
});
test('正式テンプレートに入力して両期間を取り込める',async()=>{
 const wb=XLSX.readFile(path.join(root,'public/templates/LeiPort_Import_Template_v1.1.xlsx'));
 XLSX.utils.sheet_add_aoa(wb.Sheets['展示会設定'],[['検証展示会']],{origin:'B4'});
 XLSX.utils.sheet_add_aoa(wb.Sheets['展示会設定'],[['検証店']],{origin:'B8'});
 XLSX.utils.sheet_add_aoa(wb.Sheets['商品リスト'],[['2026-09-08','2026-09-10','2026-10-01','2026-10-10']],{origin:'P4'});
 const r=await run(wb);assert.equal(r.status,200);assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].reservation_period_enabled,true);assert.equal(r.rows[0].reservation_start_date,'2026-09-08');assert.equal(r.rows[0].reservation_end_date,'2026-09-10');
 assert.equal(r.rows[0].sales_period_enabled,true);assert.equal(r.rows[0].sales_start_date,'2026-10-01');assert.equal(r.rows[0].sales_end_date,'2026-10-10');
});
for(const [label,dates,enabled] of [
 ['受付のみ',['2026-09-08','2026-09-10'],['reservation']],
 ['販売のみ',['','','2026-10-01','2026-10-10'],['sales']],
 ['両期間',['2026-09-08','2026-09-10','2026-10-01','2026-10-10'],['reservation','sales']],
 ['全空欄',[],[]],['空白文字',[' ',' ',' ',' '],[]],
 ['両期間同日',['2026-09-08','2026-09-08','2026-10-01','2026-10-01'],['reservation','sales']],
])test(label+'：保存ペイロードと既存A〜O列を検証',async()=>{
 const result=await run(workbook(dates));assert.equal(result.status,200);
 const expected={...expectedProduct,...disabled};
 for(const prefix of enabled){const offset=prefix==='reservation'?0:2;Object.assign(expected,{[prefix+'_period_enabled']:true,[prefix+'_start_date']:dates[offset],[prefix+'_end_date']:dates[offset+1]});}
 assert.deepEqual(result.rows,[expected]);
});
test('旧Excel：期間列なしでも保存し展示会日付を商品に流用しない',async()=>{
 const r=await run(workbook([],true));assert.equal(r.status,200);assert.deepEqual(r.rows,[{...expectedProduct,...disabled}]);
 assert.equal(r.writes.find(w=>w.table==='exhibitions'&&w.operation==='insert').data.start_date,'2026-01-01');
});
for(const [label,dates,field] of [
 ['受付開始のみ',['2026-09-08'],'受付終了日'],['受付終了のみ',['','2026-09-08'],'受付開始日'],
 ['販売開始のみ',['','','2026-09-08'],'販売終了日'],['販売終了のみ',['','','','2026-09-08'],'販売開始日'],
 ['受付逆転',['2026-09-10','2026-09-08'],'受付終了日'],['販売逆転',['','','2026-09-10','2026-09-08'],'販売終了日'],
 ['存在しない日',['2026-02-30','2026-03-01'],'受付開始日'],['不正形式',['bad','2026-03-01'],'受付開始日'],
 ['販売不正日',['','','2026-13-01','2026-12-01'],'販売開始日'],
])test(label+'：行・項目を表示し書込しない',async()=>{
 const r=await run(workbook(dates));assert.equal(r.status,400);assert.match(r.body.error,/4行目/);assert.ok(r.body.error.includes(field));assert.deepEqual(r.writes,[]);
});
test('後続行のエラーでも全行のDB書込前に停止',async()=>{
 const r=await run(workbook(['2026-09-01','2026-09-02'],false,['2026-09-01']));assert.equal(r.status,400);assert.match(r.body.error,/5行目.*受付終了日/);assert.deepEqual(r.writes,[]);
});
test('Excel日付セルをYYYY-MM-DDで保存',async()=>{
 const r=await run(workbook([new Date('2026-09-08T00:00:00Z'),new Date('2026-09-10T00:00:00Z')]));assert.equal(r.status,200);assert.equal(r.rows[0].reservation_start_date,'2026-09-08');assert.equal(r.rows[0].reservation_end_date,'2026-09-10');
});
test('日付文字列のゼロ埋めとスラッシュ',async()=>{
 const r=await run(workbook(['2026/9/8','2026-9-10']));assert.equal(r.status,200);assert.equal(r.rows[0].reservation_start_date,'2026-09-08');assert.equal(r.rows[0].reservation_end_date,'2026-09-10');
});
test('権限なしでは書込しない',async()=>{const r=await run(workbook(),false);assert.equal(r.status,403);assert.deepEqual(r.writes,[])});
test('期間列の誤記・順序違いは書込せず列名を表示',async()=>{const wb=workbook();wb.Sheets['商品リスト'].P3.v='誤記';const r=await run(wb);assert.equal(r.status,400);assert.match(r.body.error,/列P.*受付開始日/);assert.deepEqual(r.writes,[])});
