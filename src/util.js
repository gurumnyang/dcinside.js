// util.js
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => {
        rl.question(query, answer => {
            resolve(answer.trim());
        });
    });
}

function validateNumberInput(input, defaultValue) {
    const number = parseInt(input, 10);
    return isNaN(number) ? defaultValue : number;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    askQuestion,
    validateNumberInput,
    delay
}