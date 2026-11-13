module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    testTimeout: 30000,
    // Um worker: os testes compartilham um banco.
    maxWorkers: 1,
    // Evita "A worker process has failed to exit gracefully" por causa do
    // handle aberto do sqlite3/pg.
    forceExit: true,
    verbose: true,
    collectCoverageFrom: [
        'routes/**/*.js',
        'middleware/**/*.js',
        'config/**/*.js'
    ]
};
