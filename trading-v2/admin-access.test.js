import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeReviewRequest} from './admin-access.js';

const secret='admin_review_random_test_secret_01234567890123456789';
test('admin review disabled if no strong server-side token is configured',()=>{
 assert.deepEqual(authorizeReviewRequest('Bearer '+secret,{secret:undefined}).authorized,false);
 assert.equal(authorizeReviewRequest('Bearer '+secret,{secret:''}).reason,'NOT_CONFIGURED');
 assert.equal(authorizeReviewRequest('Bearer '+secret,{secret:'short'}).reason,'NOT_CONFIGURED');
});
test('admin review demands correct bearer with constant-time digest comparison',()=>{
 assert.equal(authorizeReviewRequest('Bearer '+secret,{secret}).authorized,true);
 assert.equal(authorizeReviewRequest('Bearer '+secret.slice(0,-1)+'x',{secret}).authorized,false);
 assert.equal(authorizeReviewRequest(secret,{secret}).authorized,false);
 assert.equal(authorizeReviewRequest(undefined,{secret}).authorized,false);
 assert.equal(authorizeReviewRequest('Bearer '+secret+' extra',{secret}).authorized,false);
});
test('admin review auth never returns configured or submitted token',()=>{
 const valid=authorizeReviewRequest('Bearer '+secret,{secret});
 const denied=authorizeReviewRequest('Bearer invalid_user_secret_012345678901',{secret});
 assert.equal(JSON.stringify(valid).includes(secret),false);
 assert.equal(JSON.stringify(denied).includes(secret),false);
});
