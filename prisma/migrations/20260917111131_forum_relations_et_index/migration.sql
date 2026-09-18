-- CreateIndex
CREATE INDEX "Community_status_visibility_memberCount_idx" ON "Community"("status", "visibility", "memberCount");

-- CreateIndex
CREATE INDEX "ForumPost_isFlagged_createdAt_idx" ON "ForumPost"("isFlagged", "createdAt");

-- CreateIndex
CREATE INDEX "ForumTopic_categoryId_isPinned_createdAt_idx" ON "ForumTopic"("categoryId", "isPinned", "createdAt");

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityChatMessage" ADD CONSTRAINT "CommunityChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

