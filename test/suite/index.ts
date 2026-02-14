import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';

export async function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, './');
    
    function addTestFiles(dir: string) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                addTestFiles(filePath);
            } else if (file.endsWith('.test.js')) {
                mocha.addFile(filePath);
            }
        }
    }
    
    addTestFiles(testsRoot);

    return new Promise((resolve, reject) => {
        try {
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}
