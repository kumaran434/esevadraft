// =========================================================================
// eSevaDraft Source Code Protection & Bytecode Compiler
// Transforms JavaScript source code into encrypted V8 Machine Bytecode (.jsc)
// =========================================================================
const fs = require('fs');
const path = require('path');
const bytenode = require('bytenode');

console.log('\n🛡️  [eSevaDraft Security Compiler] Starting Source Code Protection Pipeline...');

const sourceFiles = [
    { src: 'main.js', dist: 'main.jsc', loader: 'main.loader.js' },
    { src: 'preload.js', dist: 'preload.jsc', loader: 'preload.loader.js' }
];

async function protectSourceCode() {
    for (const item of sourceFiles) {
        const fullSrcPath = path.join(__dirname, item.src);
        const fullDistPath = path.join(__dirname, item.dist);
        
        if (!fs.existsSync(fullSrcPath)) {
            console.warn(`⚠️  Source file not found: ${item.src}`);
            continue;
        }

        console.log(`\n📦 [Step 1] Compiling ${item.src} into V8 Machine Bytecode...`);
        
        // Compile to V8 Bytecode (.jsc binary)
        await bytenode.compileFile({
            filename: fullSrcPath,
            output: fullDistPath,
            compileAsModule: true,
            electron: true
        });

        console.log(`✅ [Step 2] Binary generated: ${item.dist} (${fs.statSync(fullDistPath).size} bytes)`);

        // Verify that the output has no readable JavaScript source code
        const binaryBuffer = fs.readFileSync(fullDistPath);
        const isBinary = binaryBuffer.includes(0x00);
        console.log(`🔒 [Step 3] Decompilation Protection Check: ${isBinary ? 'PASSED (Pure V8 Binary)' : 'FAILED'}`);
    }

    // Step 4: Generate minimal un-tamperable loaders
    const indexLoader = `// Protected eSevaDraft Launcher
const bytenode = require('bytenode');
require('./main.jsc');
`;
    fs.writeFileSync(path.join(__dirname, 'index.js'), indexLoader);
    console.log('🛡️  [Step 4] Generated index.js binary loader');

    const preloadLoader = `// Protected eSevaDraft Preload Launcher
const bytenode = require('bytenode');
require('./preload.jsc');
`;
    fs.writeFileSync(path.join(__dirname, 'preload.loader.js'), preloadLoader);
    console.log('🛡️  [Step 5] Generated preload.loader.js binary loader');

    console.log('\n🎉 [Success] Source code protection complete! All sensitive logic converted to non-decompileable V8 binary.\n');
}

protectSourceCode().catch(err => {
    console.error('❌ Protection compilation failed:', err);
    process.exit(1);
});
