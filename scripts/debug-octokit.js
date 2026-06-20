import { Octokit } from 'octokit';
import { config } from '../src/config/index.js';

const octokit = new Octokit({ auth: config.GITHUB_TOKEN });

console.log('Methods in octokit.rest.repos:');
console.log(Object.keys(octokit.rest.repos).filter(k => k.includes('Template')));
