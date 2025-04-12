
const fs = require('fs');
//csv로 저장하기 위한 모듈
const path = require('path');

const askQuestion = require('../src/util.js').askQuestion;

const main = async () => {
    let filePath = await askQuestion('상대경로 기준 파일명을 입력하세요. (예: data.json): ');
    if(!filePath) {
        console.error('파일명이 입력되지 않았습니다.');
        return;
    }
    if(!filePath.endsWith('.json')) {
        console.error('파일명에 .json 확장자가 포함되어야 합니다.');
        return;
    }
    filePath = path.join(__dirname, filePath);
    //output dir은 filePath 기준으로 설정
    const OUTPUT_DIR = path.join(filePath, '..');

    if (!fs.existsSync(filePath)) {
        console.log(filePath);
        console.error('해당 위치에 해당 파일이 존재하지 않습니다.');
        return;
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let jsonData;
    try {
        jsonData = JSON.parse(fileContent);
    } catch (error) {
        console.error('JSON 파싱 중 에러 발생:', error.message);
        return;
    }
    //키값을 1~n 순서대로 리스트업하여 출력
    console.log("=====================");
    console.log("key 목록");
    //index. key
    const keys = Object.keys(jsonData[0]);
    keys.forEach((key, index) => {
        console.log(`${index + 1}. ${key}`);
    });
    console.log("=====================");
    const keyIndex = await askQuestion('유지시킬 key를 쉼표로 나눠 모두 입력하세요(기본:1,2,3,5): ') || '1,2,3,5';
    const keyIndexes = keyIndex.split(',').map(index => parseInt(index.trim()) - 1).filter(index => !isNaN(index));
    const selectedKeys = keyIndexes.map(index => keys[index]);
    console.log('선택된 키:', selectedKeys);

    jsonData = jsonData.map(item => {
        const newItem = {};
        selectedKeys.forEach(key => {
            newItem[key] = item[key];
        });
        return newItem;
    });

    jsonData = jsonData.map(item => {
        if (item.content) {
            item.content = item.content.replace(/\n/g, '\\n');
        }
        return item;
    });

    //csv 형식으로 저장
    const csvFilePath = path.join(OUTPUT_DIR, `${path.basename(filePath, '.json')}.csv`);
    const csvContent = jsonData.map(item => {
        return selectedKeys.map(key => item[key]).join(',');
    }).join('\n');


    //헤더 추가
    const header = selectedKeys.join(',') + '\n';
    fs.writeFileSync(csvFilePath, header + csvContent, 'utf-8');
    console.log(`CSV 파일이 ${csvFilePath}에 저장되었습니다.`);
}

main();