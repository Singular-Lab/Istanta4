module.exports = {
    ignorePatterns: [
        'dist',
        'build',
        'coverage',
        '*.config.js',
        '*.config.ts'
    ],
    ignoreMatches: [
        'pm2',
        'ts-node',
        'tsx',
        '@types/*'
    ],
    specials: [
        'eslint',
        'prettier',
        'tsconfig',
        'webpack',
        'babel'
    ]
}
