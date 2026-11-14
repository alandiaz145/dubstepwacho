// Do not expose storage/schema errors or cache temporary failures as media.
export const mediaError=(message,status,headOnly=false)=>new Response(headOnly?null:message,{
  status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
