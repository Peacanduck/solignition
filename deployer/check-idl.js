const fs = require('fs');
const path = require('path');

const idlPath = path.resolve(__dirname, '../../../projects/solignition/anchor/target/idl/solignition.json');

console.log('Checking IDL at:', idlPath);
console.log('File exists:', fs.existsSync(idlPath));

if (fs.existsSync(idlPath)) {
  try {
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    console.log('\nIDL Structure:');
    console.log('- Name:', idl.name);
    console.log('- Version:', idl.version);
    console.log('- Accounts:', idl.accounts?.length || 0);
    console.log('- Instructions:', idl.instructions?.length || 0);
    
    if (idl.accounts) {
      console.log('\nAccounts:');
      idl.accounts.forEach(acc => {
        console.log(`  - ${acc.name}`);
        console.log(`    Type defined:`, !!acc.type);
      });
    }
  } catch (error) {
    console.error('Error parsing IDL:', error.message);
  }
} else {
  console.error('\nIDL file not found! Make sure to:');
  console.error('1. Build your Anchor program: cd ../../../projects/solignition/anchor && anchor build');
  console.error('2. Check the path is correct');
}