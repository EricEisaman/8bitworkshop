import{c}from"./chunk-NH7VV6WU.js";import{b as h}from"./chunk-I355PYEE.js";import{P as w,d as m,f as n}from"./chunk-X73AHHJO.js";import{c as r}from"./chunk-5XECBXVR.js";import{Q as o,ca as e,fa as Q,ia as t,m as I,n as D}from"./chunk-QCCCWV3F.js";import"./chunk-N7W4C4V2.js";var f=Q([[e.UP,0,1],[e.DOWN,0,4],[e.LEFT,0,8],[e.RIGHT,0,2],[e.A,0,64],[e.B,1,64],[e.GP_A,0,64],[e.GP_B,1,64],[e.P2_UP,2,1],[e.P2_DOWN,2,4],[e.P2_LEFT,2,8],[e.P2_RIGHT,2,2],[e.P2_A,2,64],[e.P2_B,3,64]]),i=class extends c{constructor(){super();this.defaultROMSize=32768;this.ram=new Uint8Array(1024);this.read=t([[0,8191,8191,A=>this.bios?this.bios[A]:0],[24576,32767,1023,A=>this.ram[A]],[32768,65535,32767,A=>this.rom?this.rom[A]:0]]);this.write=t([[24576,32767,1023,(A,g)=>{this.ram[A]=g}]]);this.init(this,this.newIOBus(),new n(new m)),this.bios=new I().decode(D(atob(M)))}getKeyboardMap(){return f}vdpInterrupt(){this.probe.logInterrupt(0),this.cpu.NMI()}newIOBus(){return{read:A=>{switch(A&=255,A){case 252:return this.inputs[this.keypadMode?1:0]^255;case 255:return this.inputs[this.keypadMode?3:2]^255}return A>=160&&A<=191?A&1?this.vdp.readStatus():this.vdp.readData():0},write:(A,g)=>{switch(A&=255,g&=255,A>>4){case 8:case 9:this.keypadMode=!0;break;case 12:case 13:this.keypadMode=!1;break;case 10:case 11:return A&1?this.vdp.writeAddress(g):this.vdp.writeData(g);case 15:this.psg.setData(g);break}}}}loadState(A){super.loadState(A),this.keypadMode=A.kpm}saveState(){var A=super.saveState();return A.kpm=this.keypadMode,A}reset(){super.reset(),this.keypadMode=!1}},M=`
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
Bh8GHgYdAAA=`;var E=[{id:"text.c",name:"Text Mode"},{id:"hello.c",name:"Scrolling Text"},{id:"text32.c",name:"32-Column Color Text"},{id:"stars.c",name:"Scrolling Starfield"},{id:"cursorsmooth.c",name:"Moving Cursor"},{id:"simplemusic.c",name:"Simple Music"},{id:"musicplayer.c",name:"Multivoice Music"},{id:"mode2bitmap.c",name:"Mode 2 Bitmap"},{id:"mode2compressed.c",name:"Mode 2 Bitmap (LZG)"},{id:"lines.c",name:"Mode 2 Lines"},{id:"multicolor.c",name:"Multicolor Mode"},{id:"siegegame.c",name:"Siege Game"},{id:"shoot.c",name:"Solarian Game"},{id:"climber.c",name:"Climber Game"},{id:"hello.bas",name:"Hello World (CVBasic)",category:"CVBasic"},{id:"happy_face.bas",name:"Bouncing Face (CVBasic)"}],s=class extends w{constructor(){super(...arguments);this.getToolForFilename=r;this.getMemoryMap=function(){return{main:[{name:"BIOS",start:0,size:8192,type:"rom"},{name:"Cartridge Header",start:32768,size:256,type:"rom"}]}}}newMachine(){return new i}getPresets(){return E}getDefaultExtensions(){return[...super.getDefaultExtensions(),".bas"]}readAddress(A){return this.machine.read(A)}readVRAMAddress(A){return this.machine.readVRAMAddress(A)}showHelp(){return"https://8bitworkshop.com/docs/platforms/coleco/"}},a=class extends h{constructor(){super(...arguments);this.getToolForFilename=r}start(){this.startModule(this.mainElement,{jsfile:"mame8bitws.js",cfgfile:"coleco.cfg",biosfile:"coleco/313 10031-4005 73108a.u2",driver:"coleco",width:280*2,height:432,romfn:"/emulator/cart.rom",romsize:32768,preInit:function(A){}})}loadROM(A,g){this.loadROMFile(g),this.loadRegion(":coleco_cart:rom",g)}getPresets(){return E}getDefaultExtensions(){return[".c",".ns",".s",".scc",".sgb",".z",".wiz",".bas"]}};o["coleco.mame"]=a;o.coleco=s;export{E as ColecoVision_PRESETS};
//# sourceMappingURL=coleco-66Z54PQW.js.map
