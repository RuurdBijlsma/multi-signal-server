import ApiController from "./ApiController.mjs";
import Commander from 'commander';
import pJson from '../package.json';

Commander
    .version(pJson.version)
    .option('-p, --port [value]', 'Server port')
    .parse(process.argv);

const port = Commander.port ? Commander.port : 3000;

ApiController.start(port);
