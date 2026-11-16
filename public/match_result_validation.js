// Checks stored match identity/result, not URL claims. This is defense in depth,
// not a replacement for server-authoritative game state and Firestore Rules.
export function validateStoredMatchResult({uid,playerId,seat,winner,result,match,state,player}){
 if(!uid||!playerId||!match||!state||player?.uid!==uid)return null;
 const actualSeat=match.seatA===playerId?'A':match.seatB===playerId?'B':null;
 if(!actualSeat||!['A','B'].includes(state.winner))return null;
 const actualResult=state.winner===actualSeat?'win':'lose';
 if(seat!==actualSeat||winner!==state.winner||result!==actualResult)return null;
 return{seat:actualSeat,winner:state.winner,result:actualResult,turnSeq:state.turnSeq||0,kills:state.kills?.[actualSeat]||0,infil:state.infil?.[actualSeat]||0};
}
