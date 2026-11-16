// Initial cards only; preserves an existing draft until the player explicitly chooses this deck.
export const PRACTICE_DECK={nabe_tate:4,itou1:4,normal_arm:4,normal_bokusi:4,kenkyuui:4,s002:4,s003:4,s007:2};
export function validDeckMap(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const values=Object.values(input);
 return values.length>0&&values.every(n=>Number.isInteger(n)&&n>=0&&n<=4)&&values.reduce((s,n)=>s+n,0)===30;
}
