var c=0,p=5,F=new TextDecoder,l=[];for(let e of["log","warn","error"]){let o=console[e];console[e]=(...t)=>{l.push({level:e,args:t,time:Date.now()}),e==="log"&&c===p&&o.apply(console,t)}}addEventListener("message",async({data:e})=>{e.type==="runFile"?await R(e):e.type==="closeFile"?(console.log("Worker closing file:",e.name),await S(e)):e.type==="listFiles"?console.log(await y("/home/pyodide/")):console.error("Unknown request type:",e)});var{loadPyodide:k}=await import(new URL("./pyodide/pyodide.mjs",import.meta.url).href),r=(async()=>{let e=["click","jsonschema","scipy","typing-extensions"],o=["secondarycoolantprops-1.3","pygfunction-2.4.0.dev0","ghedesigner-2.0"],t=await k({packages:e});d();for(let n of o)await t.loadPackage(`wheels/${n}-py3-none-any.whl`),d();return t})();(async()=>{let o=await(await r).runPythonAsync("from ghedesigner import VERSION; VERSION");u({type:"version",version:o}),d()})();async function y(e){console.log("listFiles",e);let o=await r;return o.globals.set("walk_path",e),[...await o.runPythonAsync(`
import sys
from pathlib import Path

files = []

path = Path(walk_path)

def walk(path: Path):
    for entry in path.iterdir():
        if entry.is_dir():
            print(str(entry) + "/")
            try:
                walk(entry)
            except PermissionError as e:
                pass
        else:
            files.append(str(entry))

walk(path)
files
`)]}async function R({code:e,id:o,name:t}){let n=await r;console.log("runFile",t);let s=`/home/pyodide/${t}.json`,i=`/home/pyodide/${t}/`;console.log("inputPath",s),console.log("outputPath",i),n.FS.writeFile(s,e),n.globals.set("input_path",s),n.globals.set("output_path",i);let m=performance.now();await n.runPythonAsync(`
from pathlib import Path

from ghedesigner.main import run
from pyodide.http import pyfetch

run(Path(input_path), Path(output_path))
print("  \u2705 Simulation Successful")
`);let f=performance.now(),w=(await y(i)).reduce((h,a)=>{let P=a.startsWith(i)?a.slice(i.length):a;return h[P]=F.decode(n.FS.readFile(a)),h},{});u({type:"result",id:o,captured:l,files:w,time:Math.round((f-m)/100)/10}),l.length=0}async function g(e){let o=await r;for(let t of o.FS.readdir(e)){if(t==="."||t==="..")continue;let n=`${e}/${t}`,s=o.FS.stat(n);o.FS.isDir(s.mode)?await g(n):o.FS.unlink(n)}o.FS.rmdir(e)}async function S({name:e}){let o=await r,t=`/home/pyodide/${e}`;console.log("Unlinking",`${t}.json`),o.FS.unlink(`${t}.json`),console.log("rmdir",t),await g(`${t}/`),console.log(await y("/home/pyodide/"))}function d(){u({type:"loadingProgress",value:++c,total:p}),c===p&&(l.length=0)}function u(e){postMessage(e)}
