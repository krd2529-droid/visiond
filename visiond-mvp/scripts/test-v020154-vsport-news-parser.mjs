import assert from 'node:assert/strict';
import {extractImageUrls} from '../functions/_vsport.js';

const base='https://news.example.test/article';
assert.deepEqual(extractImageUrls('<img data-src="/photos/match.jpg">',base,4),['https://news.example.test/photos/match.jpg']);
assert.deepEqual(extractImageUrls('<img srcset="/photos/small.jpg 320w, /photos/large.jpg 1200w">',base,4),['https://news.example.test/photos/large.jpg']);
assert.deepEqual(extractImageUrls('<img data-srcset="/photos/small.jpg 320w, /photos/large.jpg 1200w" src="data:image/gif;base64,AAAA">',base,4),['https://news.example.test/photos/large.jpg']);
assert.deepEqual(extractImageUrls('<meta property="og:image" content="/photos/cover.jpg"><img data-src="/icons/logo.png"><img data-src="/photos/match.jpg">',base,4),['https://news.example.test/photos/cover.jpg','https://news.example.test/photos/match.jpg']);
console.log('PASS v0.20.154 lazy source-image choices, social priority, decorative exclusion');
