export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

// Coordinates stay in source pixels, independent of the preview's size.
export function cropRect(width,height,ratio,zoom,cx=width/2,cy=height/2){
 const baseWidth=Math.min(width,height*ratio),w=baseWidth/clamp(zoom,1,4),h=w/ratio;
 return {x:clamp(cx-w/2,0,width-w),y:clamp(cy-h/2,0,height-h),width:w,height:h};
}

export function zoomAt(state,zoom,u=.5,v=.5){
 const before=cropRect(state.width,state.height,state.ratio,state.zoom,state.cx,state.cy);
 const next=clamp(zoom,1,4),after=cropRect(state.width,state.height,state.ratio,next);
 const rect=cropRect(state.width,state.height,state.ratio,next,before.x+u*before.width+(.5-u)*after.width,before.y+v*before.height+(.5-v)*after.height);
 return {...state,zoom:next,cx:rect.x+rect.width/2,cy:rect.y+rect.height/2};
}
