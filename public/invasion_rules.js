export function normalizeGameMode(v){return v==="invasion"?"invasion":"default"}

export function boardDimensions(mode){return normalizeGameMode(mode)==="invasion"?{W:9,H:9}:{W:5,H:7}}

export function goalRow(owner,y,H=9){return owner==="A"?y===0:owner==="B"?y===H-1:false}

export function fenceEdges(f){return f.orientation==="h"?[[{x:f.x,y:f.y},{x:f.x,y:f.y+1}],[{x:f.x+1,y:f.y},{x:f.x+1,y:f.y+1}]]:f.orientation==="v"?[[{x:f.x,y:f.y},{x:f.x+1,y:f.y}],[{x:f.x,y:f.y+1},{x:f.x+1,y:f.y+1}]]:[]}

export function edgeKey(a,b){return [`${a.x},${a.y}`,`${b.x},${b.y}`].sort().join("|")}

export function fenceBlocks(fences,a,b){if(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1)return false;const key=edgeKey(a,b);return (fences||[]).some(f=>f.hp>0&&fenceEdges(f).some(([u,v])=>edgeKey(u,v)===key))}

export function goalDistance(fences,start,owner,W=9,H=9){const seen=new Set([`${start.x},${start.y}`]),q=[{...start,d:0}];for(let i=0;i<q.length;i++){const a=q[i];if(goalRow(owner,a.y,H))return a.d;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const b={x:a.x+dx,y:a.y+dy},k=`${b.x},${b.y}`;if(b.x<0||b.x>=W||b.y<0||b.y>=H||seen.has(k)||fenceBlocks(fences,a,b))continue;seen.add(k);q.push({...b,d:a.d+1})}}return Infinity}

export function validateFence(st,owner,f){if(st.gameMode!=="invasion"||!["A","B"].includes(owner))return "モードが違います";const fences=st.fences||[];if(fences.filter(w=>w.owner===owner&&w.hp>0).length>=3)return "柵は各プレイヤー3枚まで";if(st.fencePlacedTurn?.[owner]===st.turnSeq)return "柵は1ターンに1枚まで";if(!Number.isInteger(f.x)||!Number.isInteger(f.y)||!["h","v"].includes(f.orientation)||f.x<0||f.x>=8||f.y<0||f.y>=8)return "盤内の2マス分の境界を選んでください";if(fenceEdges(f).some(([a,b])=>fenceBlocks(fences,a,b)))return "既存の柵と重なっています";if(fences.some(w=>w.hp>0&&w.x===f.x&&w.y===f.y&&w.orientation!==f.orientation))return "柵を交差できません";const next=[...fences,{...f,hp:20}];for(const side of ["A","B"]){const row=side==="A"?8:0;for(let x=0;x<9;x++)if(!Number.isFinite(goalDistance(next,{x,y:row},side)))return "進軍ルートを完全に封鎖できません";for(const u of st.units||[])if(u.owner===side&&u.hp>0&&!u.panic&&!Number.isFinite(goalDistance(next,u,side)))return "ユニットの進軍ルートを完全に封鎖できません"}return ""}

export function scoreInvasion(st,unit){if(st.gameMode!=="invasion"||!unit||unit.hp<=0||unit.panic||!goalRow(unit.owner,unit.y)||!(st.units||[]).some(u=>u.id===unit.id))return false;st.infil={A:0,B:0,...st.infil};st.infil[unit.owner]=Math.min(3,Number(st.infil[unit.owner]||0)+1);st.units=st.units.filter(u=>u.id!==unit.id);return true}

export function invasionWinner(st){return (st.infil?.A||0)>=3?"A":(st.infil?.B||0)>=3?"B":null}
