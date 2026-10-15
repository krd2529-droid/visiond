// Upper-bound estimate shared by the API and editor. One written Thai consonant
// can begin at most one spoken syllable; clusters and codas intentionally overcount.
// Shorthand/repetition cannot be bounded reliably without expansion, so reject it.
export function countNewsSyllables(value){
  const speech=String(value||'');
  const thai=(speech.match(/[ก-ฮฤฦ]/gu)||[]).length;
  const latin=(speech.match(/[A-VX-Za-vx-z]/gu)||[]).length*2+(speech.match(/[Ww]/gu)||[]).length*4;
  const digits=(speech.match(/\p{N}/gu)||[]).length;
  const numericSeparators=(speech.match(/(?<=\p{N})[.,:](?=\p{N})/gu)||[]).length;
  const spokenSymbols=(speech.match(/[%#°฿$€£¥₹]/gu)||[]).length*3+(speech.match(/[/+&@=−-]/gu)||[]).length*2;
  const unknownSymbols=[...speech].some(char=>/\p{S}/u.test(char)&&!/[#°฿$€£¥₹+&@=−]/u.test(char))?31:0;
  const shorthand=/[ๆฯ]/u.test(speech)?31:0;
  return thai+latin+digits*2+numericSeparators+spokenSymbols+unknownSymbols+shorthand;
}
