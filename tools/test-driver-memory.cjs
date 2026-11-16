/** Handler-level tests only. In-memory transactions are not a substitute for Firestore rules tests. */
const {randomUUID}=require('node:crypto');
process.env.GCLOUD_PROJECT='demo-spires-admin';
require('node:module').createRequire(require('node:path').resolve(__dirname,'../functions/package.json'))('firebase-functions/v1');
const clone=value=>value == null ? value : JSON.parse(JSON.stringify(value));
class MemoryDb {
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 settings(){}
 collection(path){return new Collection(this,path);}
 async runTransaction(callback){
  const previous=this.queue;let release;this.queue=new Promise(resolve=>release=resolve);await previous;
  const actions=[];
  const tx={get:ref=>ref.get(),set:(ref,value,options)=>actions.push(()=>ref.set(value,options)),update:(ref,value)=>actions.push(()=>ref.update(value)),create:(ref,value)=>actions.push(()=>{if(this.docs.has(ref.path))throw Error('Duplicate document');return ref.set(value);}),delete:ref=>actions.push(()=>ref.delete())};
  try{const value=await callback(tx);for(const action of actions)await action();return value;}finally{release();}
 }
}
class Ref {
 constructor(db,path){this.db=db;this.path=path;this.id=path.split('/').pop();}
 async get(){const value=clone(this.db.docs.get(this.path));return {id:this.id,exists:value!==undefined,data:()=>value,ref:this};}
 async set(value,options){this.db.docs.set(this.path,options?.merge?{...this.db.docs.get(this.path),...clone(value)}:clone(value));}
 async update(value){if(!this.db.docs.has(this.path))throw Error('Missing document');await this.set(value,{merge:true});}
 async delete(){this.db.docs.delete(this.path);}
 collection(name){return new Collection(this.db,this.path+'/'+name);}
}
class Collection {
 constructor(db,path,filters=[],count=Infinity){this.db=db;this.path=path;this.filters=filters;this.count=count;}
 doc(id=randomUUID()){return new Ref(this.db,this.path+'/'+id);}
 where(field,operator,value){if(operator!=='==')throw Error('Unsupported test operator');return new Collection(this.db,this.path,[...this.filters,[field,value]],this.count);}
 limit(count){return new Collection(this.db,this.path,this.filters,count);}
 async get(){const docs=[];for(const [key,value]of this.db.docs){if(!key.startsWith(this.path+'/')||key.slice(this.path.length+1).includes('/'))continue;if(!this.filters.every(([field,wanted])=>value[field]===wanted))continue;docs.push(await new Ref(this.db,key).get());if(docs.length===this.count)break;}return {docs,size:docs.length};}
}
const db=new MemoryDb();
const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=>new Date().toISOString()};
const auth={createCustomToken:async()=> 'synthetic-token-no-real-auth'};
const adminPath=require.resolve('../functions/node_modules/firebase-admin');
require(adminPath);
require.cache[adminPath].exports={firestore,auth:()=>auth,initializeApp:()=>{},app:()=>({delete:async()=>{}})};
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8180';
require('./test-driver-emulator.cjs');
