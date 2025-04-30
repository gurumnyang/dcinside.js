const { getPost } = require('../index');
const {scrapeBoardPage} = require('../src/scraper');

const {delay, getRandomUserAgent} = require('../src/util');

(async ()=>{
    const page = 1;
    const galleryId = 'chatgpt';
    const boardType = 'all';
    const delayMs = 100;

    // 게시글 번호 목록 수집
    // const postNumbers = await scrapeBoardPage(page, galleryId, { boardType: boardType, delay: delayMs });

    // console.log(postNumbers[0])
    

    const postContent = await getPost({
        galleryId: galleryId,
        postNo: '22690'
    });
    console.log(postContent.comments.items);

    // console.log('수집된 게시글 번호:', postNumbers);
    
    // // 게시글 내용 가져오기
    // for (const postNo of postNumbers) {
    //     const postContent = await getPostContent(galleryId, postNo);
    //     console.log('게시글 내용:', postContent);
    //     await delay(delayMs); // 요청 간 지연
    // }
})()