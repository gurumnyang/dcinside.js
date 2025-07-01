const inquirer = require('inquirer').default;

/**
 * 사용자에게 질문을 하고 입력값을 반환합니다.
 * @param {string} query - 사용자에게 표시될 질문
 * @returns {Promise<string>} - 사용자가 입력한 답변 (공백 제거됨)
 */

async function askQuestion(query) {
    const { answer } = await inquirer.prompt([
        {
            type: 'input',
            name: 'answer',
            message: query,
        },
    ]);
    return answer.trim();
}


module.exports = askQuestion;