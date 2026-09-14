import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
export default [{ignores:['dist/**','node_modules/**','design/**','media/**','.wrangler/**']},js.configs.recommended,...ts.configs.recommended,{languageOptions:{globals:{...globals.browser,...globals.node}},rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],'no-unused-vars':'off','no-empty':['error',{allowEmptyCatch:true}]}},{files:['**/*.mjs'],rules:{'@typescript-eslint/no-unused-vars':['error',{args:'none',varsIgnorePattern:'^(token_hash|version)$'}]}}];
