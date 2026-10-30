// Conservative routing contract, not a semantic entailment detector. For these
// comparative questions, consolidate conclusions with both operand citations.
export function requiresCombinedEvidence(question:string){
 const bothFiles=/\.(?:pdf|docx)\b/i.test(question)&&/\.csv\b/i.test(question);
 const comparison=/\b(compare|apply|exceed\w*|below|above|meet\w*|shortfall|late|missed|breach\w*|violat\w*)\b|fall short|who needs/i.test(question);
 const explicitUse=/\busing\b/i.test(question);
 if(/\.(?:pdf|docx)\b/i.test(question)&&!/\.csv\b|\bcsv\b|\bdataset\b/i.test(question))return false;
 return (/\b(sla|deadline)\b/i.test(question)&&/\b(regional|region)\b/i.test(question)&&/\blead\b/i.test(question))||(bothFiles&&(explicitUse||comparison))||(comparison&&/\b(policy|sla|deadline|target|minimum|approval|limit)\b/i.test(question)&&/\b(csv|dataset|rows|teams?|sales|expense\w*|ticket\w*|incident\w*)\b/i.test(question));
}
export function combinedStatementSupported(ids:string[],question:string,documents:ReadonlyArray<{id:string;filename:string}>,csv:ReadonlyArray<{id:string;filename:string}>){
 const mentioned=(filename:string)=>questionMentionsFilename(question,filename);
 const doc=documents.some(s=>ids.includes(s.id)&&(!/\.(?:pdf|docx)\b/i.test(question)||mentioned(s.filename)));
 const data=csv.some(s=>ids.includes(s.id)&&(!/\.csv\b/i.test(question)||mentioned(s.filename)));
 return doc&&data;
}

export function questionMentionsFilename(question:string,filename:string){
 const q=question.toLowerCase(),f=filename.toLowerCase();let at=q.indexOf(f);
 while(at>=0){const end=at+f.length;const before=at===0||/[\s"'([{]/.test(q[at-1]);const after=end===q.length||/[\s"',!?)}\]]/.test(q[end])||(q[end]==='.'&&(end+1===q.length||/\s/.test(q[end+1])));if(before&&after)return true;at=q.indexOf(f,at+1);}
 return false;
}
