import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeAccountLink} from '../src/accountLink.js';

function open(search){
  const location={href:`https://example.test/account${search}#details`};
  const history={state:{navigation:'existing'},replaceState(state,title,path){
    assert.equal(state,this.state);
    location.href=new URL(path,location.href).href;
  }};
  return {location,history};
}

test('account links are removed from browser URL immediately while retaining tokens in memory',()=>{
  const token='a'.repeat(64),second='b'.repeat(64);
  const {location,history}=open(`?verify=${token}&reset=${second}&source=email`);
  assert.deepEqual(consumeAccountLink(location,history),{verify:token,reset:second});
  assert.equal(location.href,'https://example.test/account?source=email#details');
  assert.deepEqual(consumeAccountLink(location,history),{verify:'',reset:''});
});

test('malformed and ambiguous account-link secrets are scrubbed without being accepted',()=>{
  for(const search of ['?verify=invalid','?reset=','?reset='+ 'a'.repeat(65),'?verify='+ 'a'.repeat(64)+'&verify='+ 'b'.repeat(64)]){
    const {location,history}=open(search);
    assert.deepEqual(consumeAccountLink(location,history),{verify:'',reset:''});
    assert.equal(location.href,'https://example.test/account#details');
  }
});
