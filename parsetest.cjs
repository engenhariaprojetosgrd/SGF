const XLSX = require('xlsx')
const fs = require('fs')
const buf = fs.readFileSync('/sessions/eloquent-focused-ramanujan/mnt/uploads/ocorrências corretivas escavadeira.xlsx')
const wb = XLSX.read(buf, { type:'buffer', cellDates:true })
const ws = wb.Sheets['OC.MANUT'] ?? wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:false, defval:'' })
function durToSec(v){ if(!v) return 0; const m=String(v).match(/(\d+):(\d+):(\d+)/); return m?(+m[1])*3600+(+m[2])*60+(+m[3]):0 }
function parseDia(v){ if(!v) return null; const s=String(v); let m=s.match(/(\d{4})-(\d{2})-(\d{2})/); if(m) return `${m[1]}-${m[2]}-${m[3]}`; m=s.match(/(\d{2})\/(\d{2})\/(\d{4})/); if(m) return `${m[3]}-${m[2]}-${m[1]}`; return null }
let equip=null, recs=[]
for(const r of rows){
  const c0=(r[0]??'').toString().trim()
  if(c0.startsWith('Equipamento:')) equip=c0.replace('Equipamento:','').trim().replace(/^MM/,'')
  const dia=parseDia(r[0])
  if(dia) recs.push({ dia, equip, desc:(r[1]||'').slice(0,30), subestado:r[2]||'', dur:durToSec(r[7]), resp:(r[8]||'').slice(0,15) })
}
console.log('Total:', recs.length, '| Equip:', [...new Set(recs.map(x=>x.equip))].join(','))
recs.slice(0,3).forEach(x=>console.log(JSON.stringify(x)))
console.log('Soma horas:', (recs.reduce((a,x)=>a+x.dur,0)/3600).toFixed(1))
