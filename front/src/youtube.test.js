import test from 'node:test';
import assert from 'node:assert/strict';
import { getYouTubeVideoId, getYouTubeEmbed } from './youtube.js';

test('accepts only public YouTube URL shapes', () => {
  const id = 'dQw4w9WgXcQ';
  assert.equal(getYouTubeVideoId('https://www.youtube.com/watch?v=' + id), id);
  assert.equal(getYouTubeVideoId('https://youtu.be/' + id), id);
  assert.equal(getYouTubeVideoId('https://youtube.com/shorts/' + id), id);
  assert.equal(getYouTubeEmbed('https://youtu.be/' + id),
    'https://www.youtube-nocookie.com/embed/' + id);
});

test('rejects spoofed and non-YouTube URLs', () => {
  assert.equal(getYouTubeVideoId('https://youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(getYouTubeVideoId('http://youtube.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(getYouTubeVideoId('https://example.com/a.mp4'), null);
  assert.equal(getYouTubeVideoId('javascript:alert(1)'), null);
});
