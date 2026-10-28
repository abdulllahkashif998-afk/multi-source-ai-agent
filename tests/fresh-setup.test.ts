import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateFreshTarget,orderedMigrationNames} from '../src/scripts/setup-fresh-db';
import {secretCategories} from '../src/scripts/check-repository-security';
import {readdirSync} from 'node:fs';
test('fresh setup requires an explicit separate confirmed target',()=>{
 for(const [url,name] of [['','x'],['postgresql://localhost/postgres','postgres'],['postgresql://localhost/new','wrong'],['postgresql://localhost/new','new']])assert.throws(()=>validateFreshTarget(url,name,'postgresql://localhost/new'));
 assert.equal(validateFreshTarget('postgresql://localhost/fresh_test','fresh_test','postgresql://localhost/current'),'fresh_test');
});
test('fresh migrations have complete contiguous ordering',()=>{assert.equal(orderedMigrationNames(readdirSync('migrations')).length,9);assert.throws(()=>orderedMigrationNames(['006-generic-csv.sql']));});
test('secret checks identify key families without printing values',()=>{assert.deepEqual(secretCategories('gsk_'+'a'.repeat(32)),['groqKey']);assert.deepEqual(secretCategories('postgresql://APP_USER:REPLACE_LOCALLY@localhost/app'),[]);assert.deepEqual(secretCategories(['postgresql:', '', 'user:realcredential@localhost', 'app'].join('/')),['databaseCredential']);});
