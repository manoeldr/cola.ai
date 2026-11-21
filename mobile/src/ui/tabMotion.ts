const positions:Record<string,number>={'/estudar':0,'/resumos':0,'/':1,'/historico':2};
export function tabSlide(from:string,to:string):'left'|'right'{
 return (positions[to]??1)>(positions[from]??1)?'left':'right';
}
export function tabAnimation(direction:unknown):'slide_from_right'|'slide_from_left'|'default'{
 // Moving the page left means the destination enters from the right.
 return direction==='left'?'slide_from_right':direction==='right'?'slide_from_left':'default';
}
