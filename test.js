import * as fs from 'fs';
import * as util from 'util';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

import QieyunRef from 'qieyun-ref';

const QieyunTest = isMainThread ? null : await tryImport();

const schemas = [
  'tshet',
  'baxter',
  'blankego',
  'kyonh',
  'zyepheng',
  'panwuyun',
  'unt',
  'unt_j',
  'msoeg_v8',
  'mid_tang',
  'chiangxhua',
  'fanwan',
  'putonghua',
  'gwongzau',
  'zaonhe',
  'langjin',
  //'taibu',
  'ayaka_v8',
];

// <s>Reinventi radojn</s> ne, nur praktiko 😆

if (isMainThread) {
  let finishCount = 0;
  const workers = schemas.map(
    schemaName =>
      new Promise((resolve, reject) => {
        let result;
        const worker = new Worker(new URL(import.meta.url), {
          workerData: schemaName,
        });
        worker.on('message', msg => {
          result ??= msg;
        });
        worker.on('error', reject);
        worker.on('exit', code => {
          if (code) {
            reject(`Testaro ${schemaName}: elirkodo ${code}`);
          } else {
            finishCount++;
            console.log(`Finiĝinta (${finishCount}/${schemas.length}): ${schemaName}`);
            resolve(result);
          }
        });
      })
  );

  console.log('Komencante...');
  const results = await Promise.all(workers);

  let successCount = 0;
  results.forEach(([res, output], i) => {
    const schemaName = schemas[i];
    console.log();
    console.log(`[${res ? 'SUK' : 'MAL'}] ${schemaName}`);
    successCount += +res;
    output.forEach(line => console.log(line));
  });

  console.log();
  console.log(`${successCount}/${results.length} testo(j) sukcesa(j)`);
  process.exit(successCount === results.length ? 0 : 1);
} else {
  const output = [];
  const log = (...args) => {
    output.push(util.format(...args));
  };
  const res = compareQieyun(workerData, log);
  parentPort.postMessage([res, output]);
}

async function tryImport() {
  try {
    return (await import('qieyun-test')).default;
  } catch (e) {
    console.log('Loka versio de qieyun-js ne preta, bonvolu ruli:\n  npm i --no-save qieyun-test@file:<dosierindiko al loka qieyun-js>');
    throw e;
  }
}

function loadDeriver(name, qieyun) {
  // eslint-disable-next-line no-unused-vars
  const Qieyun = qieyun;
  return new Function('音韻地位', '字頭', '選項', fs.readFileSync(`node_modules/qieyun-examples/${name}.js`).toString());
}

function getDefaultOptions(derive) {
  try {
    return Object.fromEntries(
      derive().map(entry => {
        const [k, v] = entry;
        if (typeof v === 'boolean') {
          return entry;
        } else if (Array.isArray(v)) {
          return [k, v[v[0]]];
        } else {
          throw new Error(`未識別的選項：${k} ${v}`);
        }
      })
    );
  } catch {
    return {};
  }
}

function compareQieyun(schemaName, log, errLimit = 20) {
  const deriveRef = loadDeriver(schemaName, QieyunRef);
  const options = getDefaultOptions(deriveRef);
  const deriveTest = loadDeriver(schemaName, QieyunTest);

  let errCount = 0;
  let runCount = 0;
  for (const 地位ref of QieyunRef.iter音韻地位()) {
    runCount++;
    const ref = deriveRef(地位ref, 地位ref.代表字, { ...options });
    try {
      const 地位 = QieyunTest.音韻地位.from編碼(地位ref.編碼);
      const out = deriveTest(地位, 地位.代表字, { ...options });
      if (ref !== out) {
        log(`${地位ref.描述}:\n  Atendata: ${ref}\n  Ricevita: ${out}`);
        errCount++;
      }
    } catch (e) {
      log(`${地位ref.描述}: `, e);
      errCount++;
    }
    if (errCount >= errLimit) {
      log('Interrompite pro tro da eraroj');
      break;
    }
  }

  if (errCount) {
    const plus = errCount >= errLimit ? '+' : '';
    log(`${errCount}${plus}/${runCount}${plus} testo(j) malsukcesa(j)`);
    return false;
  } else {
    log(`Ĉiuj ${runCount} testoj estas sukcesaj`);
    return true;
  }
}
