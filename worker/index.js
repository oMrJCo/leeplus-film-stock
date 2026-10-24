function nextDatedId(records,kind,now=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(now).map(p=>[p.type,p.value]));const prefix=kind+'-'+parts.day+parts.month+String(Number(parts.year)+543)+'-';let n=1;for(const o of records){if(o.id.startsWith(prefix)){const suffix=o.id.slice(prefix.length);if(/^\d+$/.test(suffix))n=Math.max(n,Number(suffix)+1)}}return prefix+String(n).padStart(3,'0')}
const nextOrderId=(s,now=new Date())=>nextDatedId([...s.orders,...(s.deletedRecords||[]).filter(x=>x.kind==='orders').map(x=>({id:x.key}))],'OUT',now);
const nextCountId=(s,now=new Date())=>nextDatedId([...s.counts,...(s.deletedRecords||[]).filter(x=>x.kind==='counts').map(x=>({id:x.key}))],'CNT',now);
function nextBoxId(s,date){const [year,month,day]=date.split('-');const prefix=day+month+String(Number(year)+543);let n=s.boxes.filter(b=>s.lots.find(l=>l.id===b.lot)?.date===date).length+1;while(s.boxes.some(b=>b.id===prefix+String(n).padStart(2,'0'))||(s.deletedRecords||[]).some(r=>(r.kind==='boxes'&&r.key===prefix+String(n).padStart(2,'0'))||(r.boxes||[]).some(b=>b.id===prefix+String(n).padStart(2,'0'))))n++;return prefix+String(n).padStart(2,'0')}
const reservationQty=(o,x)=>['open','awaiting_approval'].includes(o.status)?(!x.done?x.qty:x.deferredDeduction&&!x.stockDeducted?(x.actual||0):0):0;
const normalizePhone=value=>{let phone=String(value||'').replace(/[\s()-]/g,'');if(phone.startsWith('+66'))phone='0'+phone.slice(3);return phone};
const memberFor=(s,user)=>s.members.find(m=>m.active!==false&&((m.id&&m.id===user.id)||(!user.phone&&m.email&&m.email===user.email)));
const blank=()=>({products:[],lots:[],boxes:[],orders:[],counts:[],moves:[],audit:[],members:[],owner:null});
const fail=m=>{throw Error(m)}, need=(v,m)=>v||fail(m), qty=(n,zero=false)=>need(Number.isSafeInteger(n)&&n>=(zero?0:1),'จำนวนต้องเป็นจำนวนเต็ม'+(zero?'ตั้งแต่ศูนย์':'มากกว่าศูนย์'));
const id=()=>crypto.randomUUID();
function mutate(s,a,p,user){
const member=memberFor(s,user);const admin=s.owner===user.id||member?.role==='admin';const actor=user.name?user.id:user.email;
const staff=admin||!!member;need(staff,'ไม่มีสิทธิ์ใช้งาน');
if(!['receive','verifyPickScan','pick','completePick','count'].includes(a))need(admin,'เฉพาะแอดมิน');
const box=()=>need(s.boxes.find(b=>b.id===p.box),'ไม่พบลัง');
const reserved=(bid,pid)=>s.orders.reduce((n,o)=>n+o.alloc.filter(x=>x.box===bid&&x.product===pid).reduce((k,x)=>k+reservationQty(o,x),0),0);
const locked=b=>s.counts.some(c=>c.status==='open'&&c.boxes.includes(b))||s.counts.some(c=>c.status==='review'&&c.results.some(r=>r.box===b));
let result={};
if(a==='ownerDelete'){result=deleteOwnerRecord(s,p,user);}
else if(a==='product'){need(p.code?.trim()&&p.name?.trim(),'กรอกรหัสและชื่อสินค้า');need(!s.products.some(x=>x.code.toLowerCase()===p.code.trim().toLowerCase()),'รหัสสินค้าซ้ำ');s.products.push({id:id(),code:p.code.trim(),name:p.name.trim(),model:p.model?.trim()||''});}
else if(a==='importProducts'){need(Array.isArray(p.rows)&&p.rows.length&&p.rows.length<=5000,'นำเข้าได้ครั้งละ 1–5,000 รายการ');const seen=new Set;const rows=p.rows.map((r,i)=>{need(typeof r.code==='string'&&typeof r.name==='string','ข้อมูลแถวที่ '+(i+2)+' ไม่ถูกต้อง');const code=r.code.trim(),name=r.name.trim(),model=String(r.model||'').trim();need(code&&name,'กรอกรหัสและชื่อสินค้า แถวที่ '+(i+2));need(code.length<=100&&name.length<=500&&model.length<=200,'ข้อมูลยาวเกินกำหนด แถวที่ '+(i+2));const key=code.toLowerCase();need(!seen.has(key),'รหัสซ้ำในไฟล์: '+code);seen.add(key);return {code,name,model}});let added=0,updated=0;for(const r of rows){const existing=s.products.find(x=>x.code.toLowerCase()===r.code.toLowerCase());if(existing){existing.name=r.name;existing.model=r.model;updated++}else{s.products.push({id:id(),...r});added++}}result={added,updated};}
else if(a==='ownerProfile'){need(user.id===s.owner,'เฉพาะเจ้าของระบบ');const phone=normalizePhone(p.phone),name=String(p.name||'').trim();need(/^0\d{9}$/.test(phone),'กรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0');need(name&&name.length<=100,'กรอกชื่อผู้ใช้งานไม่เกิน 100 ตัวอักษร');need(!s.members.some(m=>m.phone===phone),'เบอร์โทรซ้ำกับผู้ใช้อื่น');s.ownerProfile={name,phone,email:s.ownerProfile?.email||user.email||'',updatedAt:new Date().toISOString()};s.members=s.members.filter(m=>m.id||!m.email||m.email!==s.ownerProfile.email);}
else if(a==='member'){if(p.email&&!p.phone&&!s.ownerProfile?.phone){need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email),'อีเมลไม่ถูกต้อง');need(['admin','staff'].includes(p.role),'สิทธิ์ไม่ถูกต้อง');s.members=s.members.filter(m=>m.email!==p.email.toLowerCase());s.members.push({email:p.email.toLowerCase(),role:p.role});}else{const phone=normalizePhone(p.phone),name=String(p.name||'').trim();need(/^0\d{9}$/.test(phone),'กรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0');need(name&&name.length<=100,'กรอกชื่อผู้ใช้งานไม่เกิน 100 ตัวอักษร');need(['admin','staff'].includes(p.role),'สิทธิ์ไม่ถูกต้อง');const existing=p.id?s.members.find(m=>m.id===p.id):p.legacyEmail?s.members.find(m=>!m.id&&m.email===p.legacyEmail):null;need(!p.id&&!p.legacyEmail||existing,'ไม่พบผู้ใช้งาน');need(phone!==s.ownerProfile?.phone&&!s.members.some(m=>m!==existing&&m.phone===phone),'เบอร์โทรซ้ำกับผู้ใช้อื่น');if(existing?.id===user.id)need(p.role===existing.role,'เปลี่ยนสิทธิ์ตัวเองไม่ได้');const value={...(existing||{}),id:existing?.id||id(),name,phone,role:p.role,active:existing?.active!==false};if(existing)Object.assign(existing,value);else s.members.push(value);}}
else if(a==='memberActive'){const m=need(s.members.find(m=>m.id===p.id),'ไม่พบผู้ใช้งาน');need(m.id!==user.id,'ปิดใช้งานตัวเองไม่ได้');need(typeof p.active==='boolean','สถานะไม่ถูกต้อง');m.active=p.active;if(!p.active)s.authSessions=(s.authSessions||[]).filter(x=>x.user!==m.id);}
else if(a==='lot'){qty(p.qty);need(p.qty<=500,'ไม่เกิน 500 ลังต่อรอบ');need(/^\d{4}-\d{2}-\d{2}$/.test(p.date),'ระบุวันที่รับเข้า');const n=Math.max(0,...[...s.lots,...(s.deletedRecords||[]).filter(r=>r.kind==='lots').map(r=>({id:r.key}))].map(l=>Number(l.id.split('-').at(-1))||0))+1,lot={id:'LOT-'+p.date.replaceAll('-','')+'-'+String(n).padStart(3,'0'),date:p.date,status:'draft',created:new Date().toISOString()};s.lots.push(lot);for(let i=0;i<p.qty;i++)s.boxes.push({id:nextBoxId(s,lot.date),lot:lot.id,status:'pending',items:[],touched:false});result={lot:lot.id};}
else if(a==='confirmLabels'){const l=need(s.lots.find(l=>l.id===p.lot),'ไม่พบล็อต');need(l.status==='draft','ล็อตนี้รับเข้าแล้ว');l.labelsConfirmedAt=new Date().toISOString();l.labelsConfirmedBy=actor;}
else if(a==='receive'){const b=box();need(b.status==='pending'||b.status==='review','ลังนี้อนุมัติแล้ว');need(Array.isArray(p.items)&&p.items.length,'เพิ่มสินค้า');const seen=new Set;for(const x of p.items){need(s.products.some(y=>y.id===x.product),'ไม่พบสินค้าในทะเบียน');qty(x.qty);need(!seen.has(x.product),'สินค้าซ้ำในลัง');seen.add(x.product)}b.items=p.items.map(x=>({product:x.product,qty:x.qty}));b.status='review';}
else if(a==='approveLot'){const l=need(s.lots.find(l=>l.id===p.lot),'ไม่พบล็อต');need(l.status==='draft','ล็อตอนุมัติแล้ว');const bs=s.boxes.filter(b=>b.lot===l.id);need(bs.length&&bs.every(b=>b.status==='review'),'ต้องบันทึกครบทุกลังก่อนอนุมัติ');l.status='approved';l.approvedAt=new Date().toISOString();l.approvedBy=actor;l.receivedSnapshot=Object.fromEntries(bs.map(b=>[b.id,b.items.map(x=>({...x}))]));bs.forEach(b=>b.status='ready');}
else if(a==='order'){need(p.items?.length,'ระบุสินค้า');const seen=new Set,alloc=[];for(const line of p.items){qty(line.qty);need(!seen.has(line.product),'สินค้าซ้ำ');seen.add(line.product);let left=line.qty;const bs=s.boxes.filter(b=>b.status==='ready'&&!locked(b.id)).sort((a,b)=>{const la=s.lots.find(l=>l.id===a.lot),lb=s.lots.find(l=>l.id===b.lot);return la.date.localeCompare(lb.date)||la.created.localeCompare(lb.created)||a.id.localeCompare(b.id)});for(const b of bs){const x=b.items.find(x=>x.product===line.product);const available=(x?.qty||0)-reserved(b.id,line.product);if(available>0&&left){const n=Math.min(left,available);alloc.push({id:id(),box:b.id,product:line.product,qty:n,done:false});left-=n}}need(!left,'สินค้าพร้อมเบิกไม่เพียงพอ');}const orderTime=new Date();s.orders.push({id:nextOrderId(s,orderTime),items:p.items,alloc,status:'open',created:orderTime.toISOString(),by:actor});}
else if(a==='editOrder'){
 const o=need(s.orders.find(o=>o.id===p.order),'ไม่พบใบเบิก');need(['open','awaiting_approval'].includes(o.status),'แก้ไขได้เฉพาะใบเบิกที่ยังไม่ยืนยันตัดสต็อก');
 need(Array.isArray(p.items)&&p.items.length,'ระบุสินค้าอย่างน้อย 1 รายการ');
 const reason=String(p.reason||'').trim();need(reason.length>=3&&reason.length<=500,'ระบุเหตุผลการแก้ไข 3–500 ตัวอักษร');
 const totals=new Map;for(const x of p.items){qty(x.qty);need(s.products.some(y=>y.id===x.product),'ไม่พบสินค้าในทะเบียน');need(!totals.has(x.product),'สินค้าซ้ำ');totals.set(x.product,x.qty)}
 const done=o.alloc.filter(x=>x.done),picked=new Map;
 for(const x of done)picked.set(x.product,(picked.get(x.product)||0)+(x.actual||0));
 for(const [product,n]of picked)need((totals.get(product)||0)>=n,'ลดหรือลบต่ำกว่ายอดที่หยิบแล้วไม่ได้: '+(s.products.find(x=>x.id===product)?.code||product)+' หยิบแล้ว '+n+' ชิ้น');
 const remaining=p.items.map(x=>({product:x.product,qty:x.qty-(picked.get(x.product)||0)})).filter(x=>x.qty>0);
 // Use the same FIFO planner as creation, releasing only this order's unpicked reservations.
 const planning=structuredClone(s),copy=planning.orders.find(x=>x.id===o.id);copy.alloc=copy.alloc.filter(x=>x.done);
 let pending=[];if(remaining.length){mutate(planning,'order',{items:remaining},user);pending=planning.orders.at(-1).alloc;}
 const at=new Date().toISOString();o.edits??=[];o.edits.push({before:structuredClone(o.items),after:p.items.map(x=>({product:x.product,qty:x.qty})),reason,by:actor,byName:user.name||'',at});
 o.items=p.items.map(x=>({product:x.product,qty:x.qty}));o.alloc=[...done,...pending];
 if(pending.length){o.status='open';delete o.submittedAt;delete o.submittedBy;delete o.cancelledRemainder;}
 o.updatedAt=at;o.updatedBy=actor;result={order:o.id,replanned:pending.length};
}
else if(a==='cancelOrder'){const o=need(s.orders.find(o=>o.id===p.order),'ไม่พบใบเบิก');need(o.status==='open','ใบเบิกปิดแล้ว');o.alloc.filter(x=>!x.done).forEach(x=>{x.done=true;x.actual=0;x.reason='ยกเลิกโดยแอดมิน'});o.status=o.alloc.some(x=>x.deferredDeduction&&!x.stockDeducted&&x.actual>0)?'awaiting_approval':'cancelled';o.cancelledRemainder=true;}
else if(a==='verifyPickScan'){const o=need(s.orders.find(o=>o.id===p.order),'ไม่พบใบเบิก'),x=need(o.alloc.find(x=>x.id===p.line),'ไม่พบรายการ');need(o.status==='open'&&!x.done,'รายการนี้ปิดแล้ว');need(p.scan===x.box,'สแกนผิดลัง กรุณาสแกนลัง '+x.box);need(!locked(x.box),'ลังอยู่ระหว่างตรวจนับ');x.scan={token:id(),user:user.id,by:actor,at:new Date().toISOString()};}
else if(a==='completePick'){const o=need(s.orders.find(o=>o.id===p.order),'ไม่พบใบเบิก');need(o.status==='open','ใบเบิกปิดแล้ว');need(o.alloc.length&&o.alloc.every(x=>x.done),'ต้องสแกนและบันทึกให้ครบทุกใบรายการก่อน');o.status='awaiting_approval';o.submittedAt=new Date().toISOString();o.submittedBy=actor;}
else if(a==='pick'){const o=need(s.orders.find(o=>o.id===p.order),'ไม่พบใบเบิก'),x=need(o.alloc.find(x=>x.id===p.line),'ไม่พบรายการ');need(o.status==='open'&&!x.done,'รายการนี้ยืนยันแล้ว');need(p.scan===x.box,'สแกนลังไม่ตรงรายการ');need(x.scan&&x.scan.user===user.id&&x.scan.token===p.scanToken,'ต้องสแกนบาร์โค้ดลังยืนยันก่อนบันทึก');need(!locked(x.box),'ลังอยู่ระหว่างตรวจนับ');qty(p.actual,true);need(p.actual<=x.qty,'จำนวนเกินที่จอง');if(p.actual<x.qty)need(p.reason?.trim(),'ระบุเหตุผลที่หยิบไม่ครบ');const b=s.boxes.find(b=>b.id===x.box),item=b.items.find(i=>i.product===x.product);need(item.qty>=p.actual,'ยอดไม่เพียงพอ');b.touched=true;x.deferredDeduction=true;x.done=true;x.actual=p.actual;x.reason=p.reason||'';x.note=p.note||'';x.by=actor;x.at=new Date().toISOString();x.review=p.actual<x.qty?'pending':null;delete x.scan;}
else if(a==='approveOrder'){const o=need(s.orders.find(o=>o.id===p.order),'ไม่พบใบเบิก');need(o.status==='awaiting_approval','ต้องให้พนักงานส่งอนุมัติก่อน หรือใบนี้อนุมัติแล้ว');need(o.alloc.length&&o.alloc.every(x=>x.done),'รายการหยิบยังไม่ครบ');const lines=o.alloc.filter(x=>x.deferredDeduction&&!x.stockDeducted);const totals=new Map;for(const x of lines){qty(x.actual,true);need(!locked(x.box),'ลังอยู่ระหว่างตรวจนับ');const key=x.box+'|'+x.product;totals.set(key,(totals.get(key)||0)+x.actual)}for(const [key,n]of totals){const [bid,pid]=key.split('|');const item=s.boxes.find(b=>b.id===bid)?.items.find(x=>x.product===pid);need(item&&item.qty>=n,'ยอดสินค้าในลังไม่เพียงพอ กรุณาตรวจสอบก่อนอนุมัติ')}for(const x of lines){s.boxes.find(b=>b.id===x.box).items.find(i=>i.product===x.product).qty-=x.actual;x.stockDeducted=true}for(const x of o.alloc)if(x.review==='pending'){x.review='checked';x.reviewedBy=actor}o.status='completed';o.approvedAt=o.completedAt=new Date().toISOString();o.approvedBy=o.completedBy=actor;}
else if(a==='reviewPick'){const o=need(s.orders.find(o=>o.id===p.order),'ไม่พบใบเบิก');const x=need(o.alloc.find(x=>x.id===p.line),'ไม่พบรายการ');x.review='checked';}
else if(a==='openCount'){need(!s.orders.some(o=>['open','awaiting_approval'].includes(o.status)),'ปิดหรือยกเลิกใบเบิกค้างก่อนเริ่มรอบนับ');need(!s.counts.some(c=>['open','review'].includes(c.status)),'มีรอบนับที่ยังไม่ปิด');const boxes=s.boxes.filter(b=>b.status==='ready'&&b.items.some(x=>x.qty>0)).map(b=>b.id);need(boxes.length,'ยังไม่มีลังพร้อมตรวจนับ ต้องบันทึกสินค้าและอนุมัติรับเข้าก่อน');s.counts.push({id:nextCountId(s),status:'open',boxes,snapshot:Object.fromEntries(boxes.map(id=>[id,s.boxes.find(b=>b.id===id).items.map(x=>({...x}))])),results:[],created:new Date().toISOString(),createdBy:actor});}
else if(a==='refreshEmptyCount'){const c=need(s.counts.find(c=>c.id===p.count),'ไม่พบรอบนับ');need(c.status==='open'&&!c.boxes.length&&!c.results.length,'ดึงลังใหม่ได้เฉพาะรอบว่างที่ยังไม่เริ่มนับ');need(!s.orders.some(o=>['open','awaiting_approval'].includes(o.status)),'ปิดหรือยกเลิกใบเบิกค้างก่อนเริ่มรอบนับ');const boxes=s.boxes.filter(b=>b.status==='ready'&&b.items.some(x=>x.qty>0)).map(b=>b.id);need(boxes.length,'ยังไม่มีลังพร้อมตรวจนับ ต้องอนุมัติรับเข้าก่อน');c.boxes=boxes;c.snapshot=Object.fromEntries(boxes.map(id=>[id,s.boxes.find(b=>b.id===id).items.map(x=>({...x}))]));c.refreshedAt=new Date().toISOString();}
else if(a==='cancelEmptyCount'){const c=need(s.counts.find(c=>c.id===p.count),'ไม่พบรอบนับ');need(['open','review'].includes(c.status)&&!c.boxes.length&&!c.results.length,'ยกเลิกได้เฉพาะรอบว่าง');c.status='cancelled';}
else if(a==='count'){const c=need(s.counts.find(c=>c.id===p.count),'ไม่พบรอบนับ'),b=box();need(c.status==='open'&&c.boxes.includes(b.id),'ลังไม่อยู่ในรอบนับ');need(!c.results.some(r=>r.box===b.id),'ลังนี้บันทึกแล้ว');const items=b.touched?p.items:b.items.map(x=>({...x}));need(Array.isArray(items)&&items.length===b.items.length,'นับให้ครบทุกสินค้า');const seen=new Set;for(const x of items){qty(x.qty,true);need(!seen.has(x.product)&&b.items.some(y=>y.product===x.product),'รายการสินค้าไม่ถูกต้อง');seen.add(x.product)}c.results.push({box:b.id,items:items.map(x=>({...x})),before:b.items.map(x=>({...x})),by:actor,at:new Date().toISOString()});}
else if(a==='closeCount'){const c=need(s.counts.find(c=>c.id===p.count),'ไม่พบรอบนับ');need(c.status==='open','รอบนี้ปิดแล้ว');c.status='review';c.closedAt=new Date().toISOString();c.closedBy=actor;}
else if(a==='approveCount'){const c=need(s.counts.find(c=>c.id===p.count),'ไม่พบรอบนับ');need(c.status==='review','ต้องปิดรอบก่อน');for(const r of c.results){s.boxes.find(b=>b.id===r.box).items=r.items.map(x=>({...x}))}c.status='approved';c.approvedAt=new Date().toISOString();c.approvedBy=actor;}
else if(a==='replacementBox'){const l=need(s.lots.find(l=>l.id===p.lot),'ไม่พบล็อต');need(l.status==='approved','เลือกล็อตที่อนุมัติแล้ว');s.boxes.push({id:nextBoxId(s,l.date),lot:l.id,status:'ready',items:[],touched:true});}
else if(a==='move'){const from=box(),to=need(s.boxes.find(b=>b.id===p.to),'ไม่พบลังปลายทาง');need(from.id!==to.id&&from.status==='ready'&&to.status==='ready','เลือกลังพร้อมใช้งานคนละลัง');need(!locked(from.id)&&!locked(to.id),'ลังอยู่ระหว่างนับ');need(from.lot===to.lot,'รุ่นแรกย้ายได้ภายในล็อตเดียวกัน เพื่อรักษาที่มาล็อต');qty(p.qty);const x=need(from.items.find(x=>x.product===p.product),'ไม่พบสินค้า');need(x.qty-reserved(from.id,p.product)>=p.qty,'ยอดพร้อมย้ายไม่เพียงพอ');x.qty-=p.qty;let y=to.items.find(x=>x.product===p.product);if(!y){y={product:p.product,qty:0};to.items.push(y)}y.qty+=p.qty;from.touched=to.touched=true;s.moves.push({id:id(),by:actor,from:from.id,to:to.id,product:p.product,qty:p.qty,at:new Date().toISOString()});}
else fail('ไม่พบคำสั่ง');
const auditEntry={id:id(),action:a,detail:p,by:actor,byName:user.name||'',at:new Date().toISOString()};s.audit.push(auditEntry);if(a==='move')s.moves.at(-1).auditId=auditEntry.id;return result;
}

// Corrections remove live records atomically with compensating stock changes.
// Archived originals and actor/reason remain available only to the owner.
function deleteOwnerRecord(s,p,user){
need(user.id===s.owner,'เฉพาะเจ้าของระบบเท่านั้น');
const kinds=['products','lots','boxes','orders','counts','countResults','moves','members'];
need(kinds.includes(p.kind),'ประเภทข้อมูลไม่ถูกต้อง');
const reason=String(p.reason||'').trim();need(reason.length>=3&&reason.length<=500,'ระบุเหตุผลการลบ 3–500 ตัวอักษร');
need(typeof p.key==='string'&&p.confirm===p.key,'พิมพ์รหัสรายการให้ตรงเพื่อยืนยันการลบ');
const collection=p.kind==='countResults'?null:s[p.kind];
const index=collection?.findIndex((r,i)=>(r.id||('legacy-'+i))===p.key);
const round=p.kind==='countResults'?s.counts.find(c=>c.id===p.count):null;
const row=p.kind==='countResults'?round?.results.find(r=>r.box===p.key):collection?.[index];
need(row,'ไม่พบรายการ หรือรายการถูกลบแล้ว');
const before=structuredClone(row),at=new Date().toISOString();let removedBoxes=[];
const references=ids=>{
 const set=new Set(ids);
 const o=s.orders.find(o=>o.alloc.some(x=>set.has(x.box)));if(o)fail('มีใบเบิกอ้างอิง '+o.id+' ให้ลบใบเบิกนี้ก่อน');
 const c=s.counts.find(c=>c.boxes.some(b=>set.has(b))||c.results.some(r=>set.has(r.box)));if(c)fail('มีรอบตรวจนับอ้างอิง '+c.id+' ให้ลบรอบนี้ก่อน');
 const m=s.moves.find(m=>set.has(m.from)||set.has(m.to));if(m)fail('มีการย้ายสินค้าอ้างอิง '+m.from+' → '+m.to+' ให้ลบการย้ายนี้ก่อน');
};
// Audit position handles same-millisecond mutations; untraceable legacy stock
// changes cannot be reversed safely. A later linked record must be removed first.
const guardUndo=(boxes,action,match,position=null)=>{
 const pos=position??s.audit.findLastIndex(a=>a.action===action&&match(a.detail||{}));
 need(pos>=0,'รายการเดิมไม่มีประวัติครบพอสำหรับคืนยอด กรุณาตรวจสอบก่อน');
 const set=new Set(boxes),after=s.audit.slice(pos+1);
 const later=after.find(a=>{
  const d=a.detail||{};
  if(['pick','approveOrder'].includes(a.action)){const o=s.orders.find(o=>o.id===d.order);return o?.alloc.some(x=>set.has(x.box))}
  if(['count','approveCount','openCount','closeCount'].includes(a.action)){const c=s.counts.find(c=>c.id===(d.count||d.id));return a.action==='openCount'?s.counts.some(c=>c.created===a.at&&c.boxes.some(b=>set.has(b))):c?.boxes.some(b=>set.has(b))}
  if(a.action==='move')return s.moves.some(m=>m.auditId===a.id||(!m.auditId&&m.from===d.box&&m.to===d.to&&m.product===d.product&&m.at<=a.at))&&(set.has(d.box)||set.has(d.to));
  return false;
 });
 need(!later,'มีงานภายหลังเกี่ยวข้องกับลังนี้ ให้ลบงานล่าสุดก่อนคืนยอด');
 const active=s.orders.find(o=>['open','awaiting_approval'].includes(o.status)&&o!==row&&o.alloc.some(x=>set.has(x.box)));
 need(!active,'มีใบเบิกค้างเกี่ยวข้อง '+(active?.id||'')+' ให้ปิดหรือลบก่อน');
 const c=s.counts.find(c=>c!==row&&c!==round&&['open','review'].includes(c.status)&&c.boxes.some(b=>set.has(b)));
 need(!c,'มีรอบตรวจนับค้างเกี่ยวข้อง '+(c?.id||'')+' ให้ปิดหรือลบก่อน');
};
const item=(bid,pid)=>need(s.boxes.find(b=>b.id===bid)?.items.find(x=>x.product===pid),'ไม่พบยอดสินค้าในลังสำหรับคืนรายการ');
if(p.kind==='products'){
 need(!s.boxes.some(b=>b.items.some(x=>x.product===row.id))&&!s.orders.some(o=>o.items.some(x=>x.product===row.id)||o.alloc.some(x=>x.product===row.id))&&!s.moves.some(m=>m.product===row.id)&&!s.counts.some(c=>[...Object.values(c.snapshot||{}),...c.results.map(r=>r.items),...c.results.map(r=>r.before||[])].some(items=>items.some(x=>x.product===row.id))),'สินค้านี้มีรายการอ้างอิง ให้ลบรายการที่เกี่ยวข้องก่อน');
}else if(p.kind==='lots'||p.kind==='boxes'){
 removedBoxes=p.kind==='lots'?s.boxes.filter(b=>b.lot===row.id):[row];references(removedBoxes.map(b=>b.id));
 if(p.kind==='lots')s.boxes=s.boxes.filter(b=>b.lot!==row.id);
 else {const l=s.lots.find(l=>l.id===row.lot);if(l?.receivedSnapshot)delete l.receivedSnapshot[row.id]}
}else if(p.kind==='orders'){
 const deducted=row.alloc.filter(x=>x.done&&(x.stockDeducted||!x.deferredDeduction));
 if(deducted.some(x=>x.actual>0)){
  const action=row.approvedAt?'approveOrder':'pick';
  guardUndo(row.alloc.map(x=>x.box),action,d=>d.order===row.id);
  for(const x of deducted){qty(x.actual,true);need(Number.isSafeInteger(item(x.box,x.product).qty+x.actual),'จำนวนคืนยอดเกินกำหนด')}
  for(const x of deducted)item(x.box,x.product).qty+=x.actual;
 }
}else if(p.kind==='counts'||p.kind==='countResults'){
 const c=round||row,results=round?[row]:c.results;
 if(c.status==='approved'&&results.length){
  guardUndo(results.map(r=>r.box),'approveCount',d=>d.count===c.id);
  for(const r of results){need(Array.isArray(r.before),'ไม่มีข้อมูลยอดก่อนนับสำหรับคืนรายการ');need(s.boxes.some(b=>b.id===r.box),'ไม่พบลังสำหรับคืนยอด')}
  for(const r of results)s.boxes.find(b=>b.id===r.box).items=structuredClone(r.before);
 }
 if(round)round.results=round.results.filter(r=>r.box!==p.key);
}else if(p.kind==='moves'){
 const pos=row.auditId?s.audit.findIndex(a=>a.id===row.auditId):s.audit.findIndex(a=>a.action==='move'&&a.detail?.box===row.from&&a.detail?.to===row.to&&a.detail?.product===row.product&&a.detail?.qty===row.qty&&a.at>=row.at);
 need(pos>=0,'ไม่มีประวัติการย้ายครบพอสำหรับคืนยอด');
 guardUndo([row.from,row.to],'move',()=>true,pos);
 qty(row.qty);const from=item(row.from,row.product),to=item(row.to,row.product);
 need(to.qty>=row.qty,'ยอดปลายทางไม่พอคืนการย้าย');need(Number.isSafeInteger(from.qty+row.qty),'จำนวนคืนยอดเกินกำหนด');
 to.qty-=row.qty;from.qty+=row.qty;
}else if(p.kind==='members'){
 need(row.id!==s.owner&&row.id!==user.id,'ลบบัญชีเจ้าของที่กำลังใช้งานไม่ได้');
 s.authSessions=(s.authSessions||[]).filter(x=>x.user!==row.id);
}
if(collection)collection.splice(index,1);
s.deletedRecords??=[];const archive={id:id(),kind:p.kind,key:p.key,count:p.count||null,record:before,boxes:removedBoxes.map(b=>structuredClone(b)),reason,by:user.id,byName:user.name||'',at};s.deletedRecords.push(archive);
return {deleted:true,archive:archive.id};
}

const LIMIT=8*1024*1024;
async function bridge(env,operation,data,revision){
 if(!env.FILM_BRIDGE_KEY||!env.FILM_BRIDGE_URL)throw Error('Film database not configured');
 const response=await fetch(env.FILM_BRIDGE_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Film-Bridge-Key':env.FILM_BRIDGE_KEY},body:JSON.stringify({operation,data,revision}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Film database unavailable');
 const reader=response.body.getReader();let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT){await reader.cancel();throw Error('Film state too large')}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes));
}
function createDatabase(env){return {prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){if(!sql.startsWith('SELECT revision,data FROM warehouse_state'))throw Error('Unsupported film query');const row=await bridge(env,'read');return {revision:row.revision,data:JSON.stringify(row.data)}},async run(){if(!sql.startsWith('UPDATE warehouse_state SET data=?'))throw Error('Film storage cannot be initialized from a public request');const result=await bridge(env,'write',JSON.parse(args[0]),args[1]);return {meta:{changes:result.changed?1:0}}}}}}}


const reply=(x,status=200,headers={})=>Response.json(x,{status,headers:{'Cache-Control':'no-store',...headers}});
const sha256=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const sessionCookie=(token='',age=43200,realm='admin')=>'warehouse_'+realm+'_session='+token+'; Path=/; Max-Age='+age+'; HttpOnly; Secure; SameSite=Strict';
const requestIdentity=()=>({id:null,email:''});
const randomToken=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function saveState(env,s,revision){const write=await env.DB.prepare('UPDATE warehouse_state SET data=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(s),revision).run();return !!write.meta.changes}
function profileUser(s,key){if(key===s.owner)return {id:s.owner,email:s.ownerProfile?.email||'',name:s.ownerProfile?.name||'เจ้าของระบบ',phone:s.ownerProfile?.phone||'',admin:true,owner:true};const m=s.members.find(m=>m.id===key&&m.active!==false&&m.phone);return m?{id:m.id,email:m.email||'',name:m.name,phone:m.phone,admin:m.role==='admin',owner:false}:null}
function nameDirectory(s){const names={};if(s.ownerProfile){names[s.owner]=s.ownerProfile.name;if(s.ownerProfile.email)names[s.ownerProfile.email]=s.ownerProfile.name}for(const m of s.members){const name=m.name||'ผู้ใช้งานเดิม (ยังไม่ตั้งชื่อ)';if(m.id)names[m.id]=name;if(m.email)names[m.email]=name}for(const a of s.audit)if(a.byName&&!names[a.by])names[a.by]=a.byName;return names}
function publicState(s,admin,owner=false){const data={...s,userNames:nameDirectory(s)};delete data.authSessions;delete data.authAttempts;delete data.maintenanceResets;if(!owner)delete data.deletedRecords;if(!admin){delete data.members;delete data.audit;delete data.owner;delete data.ownerProfile}return data}
const core={async fetch(req,env){const url=new URL(req.url);if(!url.pathname.startsWith('/api/'))return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});try{if(!env.DB)return reply({error:'ฐานข้อมูลยังไม่พร้อม'},503);if(!['GET','POST'].includes(req.method))return reply({error:'ไม่รองรับ'},405);if(req.method==='POST'&&![url.origin,env.APP_ORIGIN].includes(req.headers.get('Origin')))return reply({error:'แหล่งคำขอไม่ถูกต้อง'},403);const identity=requestIdentity(req);let row=await env.DB.prepare('SELECT revision,data FROM warehouse_state WHERE id=1').first();if(!row){if(!identity.id)return reply({error:'ระบบยังไม่ได้ตั้งค่า'},401);await env.DB.prepare('INSERT OR IGNORE INTO warehouse_state (id,revision,data) VALUES (1,0,?)').bind(JSON.stringify({...blank(),owner:identity.id})).run();row=await env.DB.prepare('SELECT revision,data FROM warehouse_state WHERE id=1').first()}const s=JSON.parse(row.data),now=Date.now(),mode=req.headers.get('X-Warehouse-Mode')==='staff'?'staff':'admin';const cookies=Object.fromEntries((req.headers.get('Cookie')||'').split(';').map(x=>x.trim().split(/=(.*)/s).slice(0,2)).filter(x=>x.length===2));const cookieNames=mode==='staff'?['warehouse_staff_session','warehouse_session']:['warehouse_admin_session','warehouse_session','warehouse_staff_session'];const selectedCookie=cookieNames.find(name=>cookies[name]);const sessionToken=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';const sessionHash=sessionToken?await sha256(sessionToken):'';const session=s.authSessions?.find(x=>x.hash===sessionHash&&x.expires>now);let user=session?profileUser(s,session.user):null;
if(url.pathname==='/api/auth/login'&&req.method==='POST'){const body=await req.json(),phone=normalizePhone(body.phone);const key=await sha256('ip:'+(req.headers.get('CF-Connecting-IP')||'local'));s.authAttempts=(s.authAttempts||[]).filter(a=>a.until>now).slice(-1000);const attempts=s.authAttempts.find(a=>a.key===key);if(attempts?.count>=20)return reply({error:'ลองหลายครั้งเกินไป กรุณารอ 15 นาที'},429);const match=phone===s.ownerProfile?.phone?s.owner:s.members.find(m=>m.phone===phone&&m.active!==false)?.id;const account=/^0\d{9}$/.test(phone)&&match?profileUser(s,match):null;if(!account){if(attempts)attempts.count++;else s.authAttempts.push({key,count:1,until:now+900000});await saveState(env,s,row.revision);return reply({error:'ไม่พบเบอร์ที่เปิดใช้งาน กรุณาติดต่อแอดมิน'},401)}const realm=account.admin?mode:'staff',token=randomToken();s.authSessions=(s.authSessions||[]).filter(x=>x.expires>now).slice(-499);s.authSessions.push({hash:await sha256(token),user:account.id,realm,expires:now+43200000});if(!await saveState(env,s,row.revision))return reply({error:'มีรายการเปลี่ยนแปลง กรุณากดเข้าใช้งานอีกครั้ง'},409);return reply({ok:true,admin:account.admin,token,realm},200,{'Set-Cookie':sessionCookie(token,43200,realm)})}
if(url.pathname==='/api/auth/logout'&&req.method==='POST'){s.authSessions=(s.authSessions||[]).filter(x=>x.hash!==sessionHash&&x.expires>now);if(!await saveState(env,s,row.revision))return reply({error:'กรุณาลองใหม่'},409);return reply({ok:true},200,{'Set-Cookie':selectedCookie==='warehouse_session'?'warehouse_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict':sessionCookie('',0,selectedCookie==='warehouse_staff_session'?'staff':mode)})}
// Existing verified accounts remain usable only while the owner has not set up phone access.
if(!user&&!s.ownerProfile?.phone&&identity.id){const m=s.members.find(m=>m.active!==false&&m.email&&m.email===identity.email);if(identity.id===s.owner||m)user={...identity,name:identity.id===s.owner?'เจ้าของระบบ':m.name||'ผู้ใช้งานเดิม',admin:identity.id===s.owner||m.role==='admin',owner:identity.id===s.owner,bootstrap:true}}
if(!user)return reply({error:'กรุณาใส่เบอร์โทรเพื่อเข้าใช้งาน'},401);if(url.pathname==='/api/state'&&req.method==='GET')return reply({state:publicState(s,user.admin,user.owner),revision:row.revision,user:{...user,setupRequired:user.owner&&!s.ownerProfile?.phone}});if(url.pathname!=='/api/action'||req.method!=='POST')return reply({error:'ไม่พบรายการ'},404);const body=await req.json();if(body.revision!==row.revision)return reply({error:'ข้อมูลเปลี่ยนจากผู้ใช้อื่น กรุณาโหลดใหม่',conflict:true},409);const result=mutate(s,body.action,body.payload||{},user);if(!await saveState(env,s,row.revision))return reply({error:'มีผู้ใช้อื่นบันทึกพร้อมกัน กรุณาโหลดใหม่',conflict:true},409);return reply({ok:true,result});}catch(e){return reply({error:e.message},400)}}};

async function gateway(core,req,env,ctx){
 const url=new URL(req.url),origin=req.headers.get('Origin'),allowed=origin===env.APP_ORIGIN||origin===url.origin;
 const cors={'Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Warehouse-Mode','Access-Control-Max-Age':'600'}:{})};
 if(req.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:cors});
 if(origin&&!allowed)return Response.json({error:'แหล่งคำขอไม่ถูกต้อง'},{status:403,headers:cors});
 if(url.pathname==='/health')return Response.json({service:'leeplus-film-stock-api',ready:!!env.FILM_BRIDGE_KEY},{headers:cors});
 if(!url.pathname.startsWith('/api/'))return Response.json({error:'Not found'},{status:404,headers:cors});
 if(req.method==='POST'){
  const reader=req.body?.getReader();let size=0;const chunks=[];
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();return Response.json({error:'ข้อมูลใหญ่เกินกำหนด'},{status:413,headers:cors})}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  req=new Request(req.url,{method:req.method,headers:req.headers,body:bytes});
 }
 try{const response=await core.fetch(req,{...env,DB:env.DB||createDatabase(env)},ctx);const headers=new Headers(response.headers);for(const [key,value]of Object.entries(cors))headers.set(key,value);headers.delete('Set-Cookie');return new Response(response.body,{status:response.status,headers})}
 catch{console.error(JSON.stringify({event:'film_api_failed',path:url.pathname}));return Response.json({error:'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่'},{status:503,headers:cors})}
}

export default {fetch(req,env,ctx){return gateway(core,req,env,ctx)}};
