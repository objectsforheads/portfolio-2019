#!/bin/bash

# Repo check before continuing
CURRENT_REPO=$(basename `git rev-parse --show-toplevel`)
if [ $CURRENT_REPO != 'portfolio-2019' ]
then
    echo 'Not in compiler repo - aborting'
    exit
fi

# Branch check before continuing
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
if [ $CURRENT_BRANCH = 'master' ]
then
    echo 'Currently on master branch - aborting'
    exit
fi

# If the branch is dirty, abort
if [[ -n $(git status --porcelain) ]]
then
    echo 'Branch is dirty - aborting'
    exit
fi

# Currently on a clean dev branch in SSG
# Push branch up to GH
git push --set-upstream origin $CURRENT_BRANCH

# Push an equivalent branch onto the site repo
cd dist
git checkout -b $CURRENT_BRANCH
git add *
git commit -m "release $CURRENT_BRANCH"
git push --set-upstream origin $CURRENT_BRANCH

# Clean up
git checkout master
git branch -D $CURRENT_BRANCH
cd ..
git checkout master
git branch -D $CURRENT_BRANCH

echo "Fin - don't forget to merge this branch into master on both repo's"