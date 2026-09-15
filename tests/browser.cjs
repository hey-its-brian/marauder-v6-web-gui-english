// Run with: npm install --no-save playwright && npx playwright install chromium
// Then: node tests/browser.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(root,'index.html')));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.addInitScript(()=>{
   let controller;
   window.sent=[];
   window.closeCount=0;
   const serial=new EventTarget();
   const fake={
    async open(options){
     window.openOptions=options;
     this.readable=new ReadableStream({start(c){controller=c}});
     this.writable=new WritableStream({write(bytes){window.sent.push(new TextDecoder().decode(bytes))}});
    },
    async close(){window.closeCount++}
   };
   serial.requestPort=async()=>fake;
   window.feed=text=>controller.enqueue(new TextEncoder().encode(text));
   window.feedBytes=bytes=>controller.enqueue(new Uint8Array(bytes));
   window.unplug=()=>controller.error(new Error('USB disconnected'));
   Object.defineProperty(navigator,'serial',{value:serial});
  });

  await page.goto('http://127.0.0.1:'+server.address().port);
  assert(await page.locator('#send').isDisabled());
  assert(await page.locator('#stop').isDisabled());

  // Labels present in the new MENU (verified against the firmware `help`).
  const expectedLabels=[
   // WiFi: quick start
   'recon wifi','recon ble','recon status','recon stop','scanall','wardrive','stopscan',
   // WiFi: Sniffers
   'sniffbeacon','sniffprobe','sniffdeauth','sniffpmkid','sniffraw','sniffpwn','sniffpinescan','sniffmultissid','sniffsae','packetcount',
   // WiFi: Scanners
   'pingscan','arpscan','portscan IP','portscan ssh','portscan telnet','portscan smtp','portscan dns','portscan http','portscan https','portscan rdp',
   // WiFi: Attacks
   'attack quiet','attack beacon','attack deauth','attack probe','attack rickroll','attack badmsg','attack sleep','evilportal','karma',
   // WiFi: General
   'clearlist','select','info -a','join','join -s','randapmac','randstamac','cloneapmac','clonestamac','add AP','add station',
   'ssid -a','ssid -r','save','load','channel','settings','settings -r','mactrack','led',
   // WiFi: Lists
   'list -a','list -c','list -i','list -p','list -s','list -t','list -b','list -f','list -x','list -m',
   // Bluetooth
   'sniffbt','sniffbt airtag','sniffbt flipper','sniffbt flock','sniffbt meta','sniffskim','findmy','foxhunt',
   'blespam all','blespam sourapple','blespam applejuice','blespam google','blespam samsung','blespam windows','blespam flipper','spoofat',
'list -b','list -f',
   // GPS
   'gpsdata','nmea','gps','gpstracker','gpspoi','wardrive','wardrivepoi',
   // Device & Settings
   'info','protocolinfo','reboot','ls','brightness','update','backupspiffs','backupstatus','restorespiffs','channel','settings','settings -r','help'
  ];
  const labels=await page.evaluate(()=>[...document.querySelectorAll('.cmd')].map(b=>b.dataset.label));
  for(const label of expectedLabels){
   assert(labels.includes(label),'Missing menu entry: '+label);
  }

  // Filtering by 'recon' should return exactly 4 entries.
await page.fill('#menuFilter','recon');
const reconCount = await page.locator('.cmd').count();
assert(reconCount >= 4, 'Filter "recon" must show at least 4 commands');
  await page.fill('#menuFilter','');

  await page.click('#connect');
  await page.waitForFunction(()=>document.querySelector('#stateText').textContent==='Connected');
  assert.equal((await page.evaluate(()=>window.openOptions)).baudRate,115200);

  // Helper: opens the parent <details> and returns the button.
  async function reveal(label,index=0){
   const b=page.locator('[data-label="'+label+'"]').nth(index);
   await b.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true});
   return b;
  }

  // Aliases: each menu label must send exactly the real command.
  const aliases={
   'recon wifi':'recon wifi',
   'recon ble':'recon ble',
   'recon status':'recon status',
   'recon stop':'recon stop',
   'scanall':'scanall',
   'sniffpwn':'sniffpwn',
   'sniffpinescan':'sniffpinescan',
   'sniffmultissid':'sniffmultissid',
   'sniffsae':'sniffsae',
   'packetcount':'packetcount',
   'sniffbt airtag':'sniffbt -t airtag',
   'sniffbt flipper':'sniffbt -t flipper',
   'sniffbt flock':'sniffbt -t flock',
   'sniffbt meta':'sniffbt -t meta',
   'sniffskim':'sniffskim',
      'spoofat':'spoofat',
   'gpstracker':'gpstracker',
   'gpspoi':'gpspoi',
   'wardrivepoi':'wardrivepoi',
   'help':'help',
   'settings -r':'settings -r',
   'reboot':'reboot',
   'backupspiffs':'backupspiffs',
     };
   for(const [label,command] of Object.entries(aliases)){
   const b=await reveal(label);
   await b.click();
   await page.waitForTimeout(50);
   if(await page.locator('#actionEditor').isVisible()){
    await page.click('#cancelAction');
    continue;
   }
   assert.equal((await page.evaluate(()=>window.sent)).at(-1),command+'\n',label);
  }

  // Editor validation: portscan IP requires an index, then sends it.
  let b=await reveal('portscan IP');
  await b.click();
  let previous=await page.evaluate(()=>window.sent.length);
  await page.click('#runAction');
  assert.equal(await page.evaluate(()=>window.sent.length),previous);
  await page.locator('#actionFields input').fill('3');
  await page.click('#runAction');
  assert.equal((await page.evaluate(()=>window.sent)).at(-1),'portscan -a -t 3\n');

  // Editor validation: join with a password containing spaces.
  b=await reveal('join');
  await b.click();
  let fields=page.locator('#actionFields input,#actionFields select');
  await fields.nth(0).fill('2');
  await fields.nth(1).fill('clave con espacio');
  await page.click('#runAction');
  assert.equal((await page.evaluate(()=>window.sent)).at(-1),'join -a 2 -p "clave con espacio"\n');

  // Editor validation: brightness with range 0-9.
  b=await reveal('brightness');
  await b.click();
  fields=page.locator('#actionFields input,#actionFields select');
  await fields.nth(1).fill('10');
  previous=await page.evaluate(()=>window.sent.length);
  await page.click('#runAction');
  assert.equal(await page.evaluate(()=>window.sent.length),previous);
  await fields.nth(1).fill('7');
  await page.click('#runAction');
  assert.equal((await page.evaluate(()=>window.sent)).at(-1),'brightness -s 7\n');

  // XSS: HTML received over Serial must be shown as text.
  await page.evaluate(()=>{window.feedBytes([195]);window.feedBytes([177]);window.feed('<img src=x onerror=alert(1)>\n')});
  await page.waitForFunction(()=>document.querySelector('#terminal').textContent.includes('ñ<img'));
  assert.equal(await page.locator('#terminal img').count(),0);

  // LF vs CRLF.
  await page.selectOption('#eol','crlf');
  await page.fill('#command','info');
  await page.click('#send');
  assert.equal((await page.evaluate(()=>window.sent)).at(-1),'info\r\n');

   // A command with a line break must be rejected (direct validation).
  const count=await page.evaluate(()=>window.sent.length);
  const rejected=await page.evaluate(()=>{
    try { validateCommand('info\nbad'); return false; }
    catch(e){ return e.message; }
  });
  assert(rejected && rejected.includes('line breaks'),'validateCommand must reject \\n: '+rejected);
  assert.equal(await page.evaluate(()=>window.sent.length),count);

  // Stop button sends stopscan with the current EOL (CRLF).
  await page.click('#stop');
  assert.equal((await page.evaluate(()=>window.sent)).at(-1),'stopscan\r\n');

  // Disconnection and reconnection.
  await page.click('#connect');
  await page.waitForFunction(()=>window.closeCount===1);
  assert(await page.locator('#send').isDisabled());
  await page.click('#connect');
  await page.waitForFunction(()=>document.querySelector('#stateText').textContent==='Connected');

  // Abrupt disconnection (USB unplug) -> returns to Disconnected.
  await page.evaluate(()=>window.unplug());
  await page.waitForFunction(()=>document.querySelector('#stateText').textContent==='Disconnected');

  // Mobile responsive.
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const stopBox=await page.locator('#stop').boundingBox();
  assert(stopBox.y>=0&&stopBox.y+stopBox.height<=844);
  assert.deepEqual(errors,[]);
  console.log('PASS: menu verified against help v1.16.0, recon/BT/GPS aliases, validation, Web Serial, UTF-8/XSS, LF/CRLF, filter, reconnection and responsive.');
 }finally{
  if(browser)await browser.close();
  server.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});