import { hashPassword } from '../lib/auth';
import pool from '../lib/db';
async function main() {
 const [id,email]=process.argv.slice(2);
 if(!id||!email||!/^[1-9]\d{0,18}$/.test(id)||BigInt(id)>BigInt('9223372036854775807'))throw new Error('Provide the existing user ID and exact email as arguments, and the new password on stdin.');
 let password='';
 for await(const chunk of process.stdin){password+=chunk.toString();if(Buffer.byteLength(password)>512)throw new Error('Password too large.');}
 if(password.length<12||password.length>128)throw new Error('Use a 12–128 character password.');
 const encoded=await hashPassword(password);password='';
 const client=await pool.connect();
 try{
 await client.query('BEGIN');
 const found=await client.query('SELECT id FROM users WHERE id=$1 AND email=$2 FOR UPDATE',[id,email]);
 if(found.rows.length!==1)throw new Error('Account does not match.');
 await client.query('INSERT INTO auth_credentials(user_id,password_hash) VALUES($1,$2)',[id,encoded]);
 await client.query('COMMIT');console.log('Existing account enrolled. Ownership and user records were not changed.');
 }catch{await client.query('ROLLBACK');throw new Error('Enrollment failed. Verify account details and that it is not already enrolled.');}finally{client.release();}
}
main().catch(()=>{console.error('Enrollment failed; verify arguments, password input and account state.');process.exitCode=1;}).finally(()=>pool.end());
