const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const router = require('express').Router();
const axios = require('axios');

require('dotenv').config();

const LOCAL_REPO_PATH = path.resolve('local-clone');
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
const SOURCE_JSON_DIR = path.join(PROJECT_ROOT, 'monitoring_requests');

router.post('/submit', async (req, res) => {
  const fileData = req.body.formData;
  const llm_topic = req.body.llm_topic;
  const fileName = fileData.identifier || `request-${Date.now()}`;
  const monitoring_request = {};
  monitoring_request[fileData.identifier] = fileData;
  const isUpdate = req.body.is_update || false;
  
  try {
    const git = simpleGit();
    if (!fs.existsSync(LOCAL_REPO_PATH)) {
      console.log(`Cloning repository to ${LOCAL_REPO_PATH}...`);
      await git.clone(process.env.REPO_URL.replace('https://', `https://${process.env.GIT_TOKEN}@`), LOCAL_REPO_PATH);
    }

    const repoGit = simpleGit(LOCAL_REPO_PATH);
    console.log('Pulling latest changes from main branch...');
    await repoGit.pull('origin', 'main');

    await repoGit.addConfig('user.name', process.env.GIT_USERNAME);
    await repoGit.addConfig('user.email', process.env.GIT_EMAIL);

    // Create the target directory in the repo
    const targetDir = path.join(LOCAL_REPO_PATH, 'monitoring_requests');
    fs.mkdirSync(targetDir, { recursive: true });

    // Write the JSON file directly to the target location in the repo
    const targetFilePath = path.join(targetDir, `${fileName}.json`);
    fs.writeFileSync(targetFilePath, JSON.stringify(monitoring_request, null, 2));
    console.log(`File written to: ${targetFilePath}`);
    console.log(`File exists: ${fs.existsSync(targetFilePath)}`);

    const timestamp = Date.now();
    let branchName;
    if (isUpdate) {
      branchName = `update-metadata-request-${fileData.identifier}-${timestamp}`;
    }else {
      branchName = `monitoring-request-${fileData.identifier}-${timestamp}`;
    }

    const existingBranches = await repoGit.branch();
    if (existingBranches.all.includes(branchName)) {
      if (isUpdate) {
        branchName = `update-metadata-request-${fileData.identifier}-${timestamp}-${Math.floor(Math.random() * 1000)}`;
      } else {
        branchName = `monitoring-request-${fileData.identifier}-${timestamp}-${Math.floor(Math.random() * 1000)}`;
      }
    }

    console.log(`Creating and checking out branch: ${branchName}`);
    await repoGit.checkoutLocalBranch(branchName);

    // Check for and remove Git lock file if it exists
    const gitLockPath = path.join(LOCAL_REPO_PATH, '.git', 'index.lock');
    if (fs.existsSync(gitLockPath)) {
      console.log('Removing Git lock file...');
      fs.unlinkSync(gitLockPath);
    }

    // Add the .json file to the git staging area
    console.log(`Adding file to Git: monitoring_requests/${fileName}.json`);
    await repoGit.add([`monitoring_requests/${fileName}.json`]);

    const statusAfterAdd = await repoGit.status();
    console.log('Git status after add:', statusAfterAdd);

    if (statusAfterAdd.staged.length === 0) {
      console.log('No files staged for commit!');
      return res.status(400).json({ success: false, error: 'No files staged for commit' });
    }

    // Commit the changes
    console.log('Committing changes...');
    let commitMessage;
    let pr_message;
    if (isUpdate) {
      commitMessage = `Update metadata request: ${fileName}`;
    } else {
      commitMessage = `Add monitoring request: ${fileName}`;
    }
    await repoGit.commit(commitMessage, undefined, { '--no-verify': null });

    // Force push the branch to remote
    console.log(`Pushing branch ${branchName} to origin...`);
    await repoGit.push('origin', branchName, { '--force': null });
    const repoName = process.env.REPO_NAME
    const prTitle = commitMessage
    let prBody;
    if (isUpdate) {
      prBody = `This PR is a request to update the metadata of the following resource in the BLOD CLOUD.\n\n**Identifier**: ${fileData.identifier}\n**Title**: ${fileData.title}\n**Description**: ${fileData.description.en}\n**LLM Topic**: ${llm_topic?.category || 'Not classified'}${llm_topic?.sub_category ? ` - ${llm_topic.sub_category}` : ''}`;
    } else {
      prBody = `This PR is a request to insert a new dataset into the BLOD CLOUD uploaded via the form.\n\n**Identifier**: ${fileData.identifier}\n**Title**: ${fileData.title}\n**Description**: ${fileData.description.en}\n**LLM Topic**: ${llm_topic?.category || 'Not classified'}${llm_topic?.sub_category ? ` - ${llm_topic.sub_category}` : ''}`;
    }
    try {
      const prResponse = await axios.post(
        `https://api.github.com/repos/${process.env.GIT_USERNAME}/${repoName}/pulls`,
        {
          title: prTitle,
          head: branchName,
          base: 'main',
          body: prBody
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GIT_TOKEN}`,
            'Accept': 'application/vnd.github+json'
          }
        }
      );

      console.log(`Pull request created: ${prResponse.data.html_url}`);

      res.json({ 
        success: true, 
        message: 'Monitoring request committed, pushed and PR created!', 
        branch: branchName,
        file: `${fileName}.json`
      });
    } catch (apiError) {
      console.error('Failed to create pull request via GitHub API:', apiError.response?.data || apiError.message);
    }
  } catch (error) {
    console.error('Error in submit endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;