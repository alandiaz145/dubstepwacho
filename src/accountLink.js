// Keep account-link secrets in component memory after opening the page.
export function consumeAccountLink(location,history){
  const url=new URL(location.href);
  const token=name=>{
    const values=url.searchParams.getAll(name);
    return values.length===1&&/^[a-f0-9]{64}$/.test(values[0])?values[0]:'';
  };
  const verify=token('verify'),reset=token('reset');
  if(url.searchParams.has('verify')||url.searchParams.has('reset')){
    url.searchParams.delete('verify');
    url.searchParams.delete('reset');
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  }
  return {verify,reset};
}
