const express = require('express');
const path = require('path');
const fs = require('fs');
const { scrapeBoardPages, getPostContent } = require('./src/scraper');

const app = express();

// JSON Body Parser 미들웨어 추가
app.use(express.json());

// 정적 파일 제공 (public 폴더)
app.use(express.static(path.join(__dirname, 'public')));

// EJS 템플릿 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/*
  ===== 블럭별 API 엔드포인트 =====
*/

/**
 * valueBlock
 * 요청 받은 단순 값(value)을 그대로 반환함.
 */
app.post('/api/block/valueBlock', (req, res) => {
    const { value } = req.body;
    res.json({ result: value });
});

/**
 * fetchBoardInfo
 * 갤러리 ID와 페이지 범위, 게시판 유형(boardType)을 받아 게시판의 게시글 번호들을 스크래핑하고 반환.
 * boardType은 'all', 'recommend', 'notice' 중 하나로 전달됩니다.
 */
app.post('/api/block/fetchBoardInfo', async (req, res) => {
    const { galleryId, startPage, endPage, boardType } = req.body;
    try {
        const start = parseInt(startPage, 10);
        const end = parseInt(endPage, 10);
        const postNumbers = await scrapeBoardPages(start, end, galleryId, { exception_mode: boardType });
        res.json({ galleryId, startPage: start, endPage: end, boardType, fetchedPosts: postNumbers });
    } catch (error) {
        console.error('fetchBoardInfo error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * crawlPosts
 * 갤러리 ID와 crawlInput(쉼표로 구분된 게시글 번호 문자열)을 받아 개별 게시글의 상세 내용을 스크래핑하여 반환.
 */
app.post('/api/block/crawlPosts', async (req, res) => {
    const { galleryId, crawlInput } = req.body;
    try {
        if (!Array.isArray(crawlInput) || crawlInput.length === 0) {
            return res.status(400).json({ error: 'crawlInput must be a non-empty array' });
        }
        const posts = [];
        // 순차적으로 각 게시글의 상세 내용 가져오기
        for (const no of crawlInput) {
            const post = await getPostContent(galleryId, no);
            if (post) {
                posts.push(post);
            } else {
                console.error(`게시글 ${no} 크롤링 실패`);
            }
        }
        res.json({ galleryId, posts });
    } catch (error) {
        console.error('crawlPosts error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/block/crawlPost', async (req, res) => {
    const { galleryId, postNumber } = req.body;
    try {
        if (!postNumber) {
            return res.status(400).json({ error: 'postNumber is required' });
        }
        const post = await getPostContent(galleryId, postNumber);
        if (post) {
            res.json({ galleryId, post });
        } else {
            res.status(404).json({ error: `Post ${postNumber} not found` });
        }
    } catch (error) {
        console.error('crawlPost error:', error);
        res.status(500).json({ error: error.message });
    }
});


/**
 * filterPosts
 * 기존 게시글 배열과 단순한 필터 조건 문자열(예: "subject=특정제목")을 받아 해당 조건에 맞게 필터링함.
 */
app.post('/api/block/filterPosts', (req, res) => {
    const { posts, filterCondition } = req.body;
    try {
        if (!posts || !Array.isArray(posts)) {
            return res.status(400).json({ error: 'posts array is required' });
        }
        if (!filterCondition || !filterCondition.includes('=')) {
            return res.status(400).json({ error: 'filterCondition (예: key=value) is required' });
        }
        // 간단한 조건 파싱: "key=value" 형태
        const [key, value] = filterCondition.split('=').map(s => s.trim());
        const filteredPosts = posts.filter(post => {
            // 게시글 객체에 key가 존재하고, 해당 값에 value 문자열이 포함되어 있는지 검사
            return post[key] && post[key].toString().includes(value);
        });
        res.json({ filterCondition, filteredPosts });
    } catch (error) {
        console.error('filterPosts error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * etcProcess
 * 기타 임의 처리를 수행합니다.
 * 예) 데이터 분석, 정렬, 추가 가공 등을 구현할 수 있으며, 여기서는 단순히 입력 데이터를 에코합니다.
 */
app.post('/api/block/etcProcess', (req, res) => {
    const { etcInput, data } = req.body;
    // 실제 처리 로직을 추가할 수 있으며, 여기서는 단순 처리 결과를 반환
    const processed = {
        message: `Processed with etcInput: ${etcInput}`,
        originalData: data
    };
    res.json({ result: processed });
});

/**
 * exportJson
 * 데이터(JSON)를 파일로 저장합니다.
 * 입력: filename (예: "output.json") 및 data (저장할 JSON 객체)
 */
app.post('/api/block/exportJson', (req, res) => {
    const { filename, data } = req.body;
    if (!filename || !data) {
        return res.status(400).json({ error: 'filename and data are required' });
    }
    // 저장할 디렉토리: 프로젝트 루트의 "output" 폴더
    const OUTPUT_DIR = path.join(__dirname, 'output');
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    }
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', err => {
        if (err) {
            console.error('exportJson error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'JSON exported successfully', filePath });
    });
});

/*
  ===== 기본 웹 페이지 라우트 =====
*/
app.get('/', (req, res) => {
    // index.ejs 렌더링 (순차 코딩 UI 등을 포함)
    res.render('index');
});

app.get('/editor', (req, res) => {
    // editor.ejs 렌더링
    res.render('editor');
});

const PORT = process.env.PORT || 1025;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
