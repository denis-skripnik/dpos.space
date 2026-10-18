#!/usr/bin/env python3
"""Package already-built harness artifacts. Never builds, runs Android, or touches frozen evidence."""
from pathlib import Path
import hashlib,json,re,shutil,subprocess,sys,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
out=Path(sys.argv[1]); out.mkdir(parents=True,exist_ok=True)
frozen=Path(str(root)+'-evidence')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
original=json.loads((frozen/'source-manifest.json').read_text())
assert len(original)==23
for row in original: assert sha(root/row['path'])==row['sha256'],row['path']
assert sha(frozen/'candidate.patch')=='c16fb69556352137dc49d35cd96f507bbf8053dca83098bee14a24662c81f88d'
assert sha(frozen/'candidate-app-release.apk')=='e5245a12139093d21b90670fff50a0e860f7816f41cf84efbb42d65512481e31'
android=root/'android'; sdk=Path('/home/assistent/android-sdk/build-tools/35.0.0')
artifacts=[]
for src,name in [(android/'app/build/outputs/apk/debug/app-debug.apk','harness-app-debug.apk'),(android/'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk','harness-test.apk')]:
    shutil.copy2(src,out/name)
    cert=subprocess.check_output([sdk/'apksigner','verify','--print-certs',out/name],text=True)
    assert '86b51e10c666cf9c2c4ecdea8407ec068380fb242adb2fae5d237351768f3b27' in cert
    (out/(name+'.certificate.txt')).write_text(cert)
    artifacts.append({'file':name,'sha256':sha(out/name),'bytes':(out/name).stat().st_size,'certificate_sha256':'86b51e10c666cf9c2c4ecdea8407ec068380fb242adb2fae5d237351768f3b27'})
xml=subprocess.check_output([sdk/'aapt','dump','xmltree',out/'harness-test.apk','AndroidManifest.xml'],text=True)
assert 'android:targetPackage' in xml and 'space.dpos.android.debug"' in xml
(out/'test-manifest-decoded.txt').write_text(xml)
files=sorted((android/'app/src/androidTest/java/space/dpos/android').glob('GolosFullFlow*.kt'))+sorted((android/'app/src/test/java/space/dpos/android').glob('GolosFullFlow*.kt'))
files+=sorted((android/'scripts').glob('*golos_fullflow*.py'))
files.append(android/'docs/golos-fullflow-harness.md')
shutil.copy2(android/'scripts/run_golos_fullflow_android.py',out/'run_golos_fullflow_android.py')
shutil.copy2(android/'scripts/golos_fullflow_containment.py',out/'golos_fullflow_containment.py')
shutil.copy2(android/'docs/golos-fullflow-harness.md',out/'RUN-INSTRUCTIONS.md')
methods=[]
for file in files:
    if '/androidTest/' in str(file) and 'AndroidTest.kt' in file.name:
        cls='space.dpos.android.'+file.stem
        methods += [{'class':cls,'method':m} for m in re.findall(r'@Test\s+fun\s+(\w+)\s*\(',file.read_text())]
manifest={'scope':'COMPILED_AND_HOST_TESTED_NOT_ANDROID_RUN','app_package':'space.dpos.android.debug','test_package':'space.dpos.android.debug.test','runner':'androidx.test.runner.AndroidJUnitRunner','apks':artifacts,'sources':[{'path':str(f.relative_to(root)),'sha256':sha(f),'bytes':f.stat().st_size} for f in files],'methods':methods,'planned_invocations':sum('Lifecycle' not in m['class'] for m in methods)+6,'frozen_files_verified':23,'frozen_candidate_sha256':sha(frozen/'candidate-app-release.apk'),'frozen_patch_sha256':sha(frozen/'candidate.patch')}
(out/'harness-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
results=[]
xmlout=out/'host-xml'; xmlout.mkdir(exist_ok=True)
for f in sorted((android/'app/build/test-results/testDebugUnitTest').glob('TEST-*.xml')):
    r=ET.parse(f).getroot(); assert r.tag=='testsuite'
    results.append({'suite':r.get('name'),'tests':int(r.attrib['tests']),'failures':int(r.attrib['failures']),'errors':int(r.attrib['errors']),'skipped':int(r.get('skipped','0')),'time':float(r.get('time','0'))})
    shutil.copy2(f,xmlout/f.name)
assert results and sum(r['failures']+r['errors'] for r in results)==0
summary={'suites':len(results),'tests':sum(r['tests'] for r in results),'failures':sum(r['failures'] for r in results),'errors':sum(r['errors'] for r in results),'suite_runtime_s':sum(r['time'] for r in results),'results':results}
(out/'host-results.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'apks':artifacts,'host':{k:v for k,v in summary.items() if k!='results'},'methods':len(methods),'planned_invocations':manifest['planned_invocations'],'harness_host_tests':sum(r['tests'] for r in results if 'FullFlow' in r['suite']),'frozen_files_verified':len(original)},indent=2))
