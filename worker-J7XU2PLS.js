var a=0,i=6,s=[];for(let e of["log","warn","error"]){let o=console[e];console[e]=(...t)=>{s.push({level:e,args:t,time:Date.now()}),e==="log"&&a===i&&o.apply(console,t)}}addEventListener("message",async({data:e})=>{e.type==="runDemo"?await y(e.id,e.demo):e.type==="listFiles"&&await m()});var{loadPyodide:l}=await import(new URL("./pyodide/pyodide.mjs",import.meta.url).href),d=(async()=>{let e=["click","jsonschema","scipy","typing-extensions"],o=["secondarycoolantprops-1.3","pygfunction-2.3.0.dev0","ghedesigner-2.0"],t=await l();n(),await t.loadPackage(e),n();for(let r of o)await t.loadPackage(`wheels/${r}-py3-none-any.whl`),n();return t})();(async()=>{let o=await(await d).runPythonAsync("from ghedesigner import VERSION; VERSION");c({type:"version",version:o}),n()})();async function m(){await(await d).runPythonAsync(`
    import sys
    from pathlib import Path
  
    def walk(path: Path):
        for entry in path.iterdir():
            if entry.is_dir():
                print(str(entry) + "/")
                try:
                    walk(entry)
                except PermissionError as e:
                    pass
            else:
                print(entry)
  
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/")
    walk(root)
  `)}async function y(e,o){let t=await d,r=performance.now();await t.runPythonAsync(`
    from importlib.resources import files
    from json import loads
    from pathlib import Path

    import ghedesigner
    from ghedesigner.main import _run_manager_from_cli_worker as run_manager_from_cli_worker
    from jsonschema import validate, ValidationError
    from pyodide.http import pyfetch

    schema_path = files("ghedesigner") / "schemas" / "ghedesigner.schema.json"
    schema = loads(schema_path.read_text())

    res = await pyfetch("demos/${o}")
    if res.ok:
        demo_content = await res.text()
        Path("/demo.json").write_text(demo_content)
        instance = loads(demo_content)

        try:
            validate(instance=instance, schema=schema)
            print("  \u2705 Validation Successful")
        except ValidationError as error:
            print("  \u274C Validation Error:", error)

        code = run_manager_from_cli_worker(Path("/demo.json"), Path("/demo_outputs"))
        print("  \u2705 Simulation Successful, code", code)
  `);let p=performance.now();c({type:"result",id:e,name:o,captured:s,time:Math.round((p-r)/100)/10}),s.length=0}function n(){c({type:"loadingProgress",value:++a,total:i}),a===i&&(s.length=0)}function c(e){postMessage(e)}
