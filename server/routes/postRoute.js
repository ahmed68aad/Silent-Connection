import express from "express";
import upload from "../config/multer.js";
import Post from "../models/postModel.js";
import auth from "../middleWares/auth.js";
import Group from "../models/groupModel.js";
import { uploadLimiter } from "../middleWares/rateLimit.js";

const PostRouter = express.Router();

const getRequestSessionId = (req) => {
  const rawSessionId = req.get("x-session-id");

  if (typeof rawSessionId !== "string") {
    return null;
  }

  const sessionId = rawSessionId.trim();

  if (!/^[a-zA-Z0-9._:-]{8,120}$/.test(sessionId)) {
    return null;
  }

  return sessionId;
};

const toObjectIdString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
};

const buildViewSummary = (post, currentUserId) => {
  const myUserId = currentUserId.toString();
  const byUser = (post.viewStats || []).map((view) => ({
    userId: view.userId.toString(),
    count: view.count,
    firstViewedAt: view.firstViewedAt,
    lastViewedAt: view.lastViewedAt,
  }));

  const myView = byUser.find((view) => view.userId === myUserId);
  const otherUserViews = byUser.filter((view) => view.userId !== myUserId);
  const otherUserCount = otherUserViews.reduce((sum, view) => sum + view.count, 0);

  return {
    total: byUser.reduce((sum, view) => sum + view.count, 0),
    myCount: myView?.count || 0,
    otherUserCount,
    byUser,
  };
};

const buildCoupleEngagement = (post, currentUserId) => {
  const authorId = toObjectIdString(post.userId);
  const currentId = currentUserId.toString();
  const isMine = authorId === currentId;
  const partnerView = (post.viewStats || []).find(
    (view) => view.userId.toString() !== authorId,
  );
  const currentView = (post.viewStats || []).find(
    (view) => view.userId.toString() === currentId,
  );
  const authorOpenCount = post.authorOpenStats?.count || 0;

  if (isMine) {
    return {
      role: "author",
      partnerSeen: Boolean(partnerView),
      partnerViewCount: partnerView?.count || 0,
      partnerFirstViewedAt: partnerView?.firstViewedAt || null,
      partnerLastViewedAt: partnerView?.lastViewedAt || null,
      authorOpenCount,
    };
  }

  return {
    role: "partner",
    yourViewCount: currentView?.count || 0,
    yourFirstViewedAt: currentView?.firstViewedAt || null,
    yourLastViewedAt: currentView?.lastViewedAt || null,
    publisherOpenCount: authorOpenCount,
  };
};

const ensurePostingAvailable = (req, res, next) => {
  if (!req.user?.coupleId) {
    return res.status(400).json({
      success: false,
      message: "You need to connect with your partner before posting",
    });
  }

  next();
};

const getUploadedImageUrl = (file) => {
  if (file.filename) return `/uploads/posts/${file.filename}`;
  if (file.path) return file.path;
  if (file.buffer) {
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  }

  const error = new Error("Uploaded image could not be read");
  error.statusCode = 400;
  throw error;
};

const getFeedScope = async (req) => {
  const feedType = req.query.feedType === "group" ? "group" : "couple";
  const groupId = req.query.groupId?.trim();

  if (feedType === "group") {
    if (!groupId) {
      const error = new Error("groupId is required for group feed");
      error.statusCode = 400;
      throw error;
    }

    const group = await Group.findById(groupId);

    if (!group) {
      const error = new Error("Group not found");
      error.statusCode = 404;
      throw error;
    }

    if (!group.memberCoupleIds.includes(req.user.coupleId)) {
      const error = new Error("Your couple is not a member of this group");
      error.statusCode = 403;
      throw error;
    }

    return {
      feedType,
      group,
      query: {
        audience: "group",
        groupId: group._id,
      },
    };
  }

  if (!req.user.coupleId) {
    const error = new Error("Not connected");
    error.statusCode = 401;
    throw error;
  }

  return {
    feedType,
    group: null,
    query: {
      audience: "couple",
      coupleId: req.user.coupleId,
    },
  };
};

const formatPost = (post, currentUserId) => ({
  id: post._id,
  image: post.image,
  caption: post.caption,
  coupleId: post.coupleId,
  groupId: post.groupId?._id || post.groupId || null,
  audience: post.audience,
  createdAt: post.createdAt,
  seenBy: post.seenBy,
  seen: post.seenBy.some((id) => id.toString() === currentUserId.toString()),
  author: post.userId
    ? {
        id: toObjectIdString(post.userId),
        name: post.userId.name,
        profileImage: post.userId.profileImage || "",
      }
    : null,
  isMine: post.userId?._id?.toString() === currentUserId.toString(),
  group: post.groupId?._id
    ? {
        id: post.groupId._id,
        name: post.groupId.name,
        inviteCode: post.groupId.inviteCode,
      }
    : null,
  views: buildViewSummary(post, currentUserId),
  engagement:
    post.audience === "couple" ? buildCoupleEngagement(post, currentUserId) : null,
});

PostRouter.post(
  "/upload",
  auth,
  uploadLimiter,
  ensurePostingAvailable,
  upload.single("image"),
  async (req, res) => {
    try {
      const audience = req.body.audience === "group" ? "group" : "couple";
      const requestedGroupId = req.body.groupId?.trim();
      const now = new Date();

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const todayCount = await Post.countDocuments({
        userId: req.user._id,
        createdAt: { $gte: startOfDay },
      });

      if (todayCount >= 100) {
        return res.status(400).json({
          success: false,
          message: "You reached daily limit (100 posts)",
        });
      }

      const hourCount = await Post.countDocuments({
        userId: req.user._id,
        createdAt: { $gte: oneHourAgo },
      });

      if (hourCount >= 3) {
        return res.status(400).json({
          success: false,
          message: "You reached hourly limit (3 posts)",
        });
      }
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No image uploaded" });
      }

      const imageUrl = getUploadedImageUrl(req.file);
      let group = null;

      if (audience === "group") {
        if (!requestedGroupId) {
          return res.status(400).json({
            success: false,
            message: "groupId is required when posting to a group",
          });
        }

        group = await Group.findById(requestedGroupId);

        if (!group) {
          return res.status(404).json({
            success: false,
            message: "Group not found",
          });
        }

        if (!group.memberCoupleIds.includes(req.user.coupleId)) {
          return res.status(403).json({
            success: false,
            message: "Your couple is not a member of this group",
          });
        }
      }

      const newPost = await Post.create({
        image: imageUrl,
        caption: req.body.caption,
        userId: req.user._id,
        coupleId: audience === "couple" ? req.user.coupleId : null,
        groupId: audience === "group" ? group._id : null,
        audience,
        viewStats: [],
        authorOpenStats: {
          count: 0,
          lastOpenedAt: null,
          sessionIds: [],
        },
        createdAt: new Date(),
      });

      res.status(201).json({
        success: true,
        post: newPost,
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ success: false, message: err.message });
    }
  },
);
PostRouter.get("/feed", auth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      50,
    );
    const skip = (page - 1) * limit;
    const scope = await getFeedScope(req);
    const query = scope.query;
    const sessionId = getRequestSessionId(req) || `legacy-${req.user._id.toString()}`;

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name profileImage")
        .populate("groupId", "name inviteCode"),
      Post.countDocuments(query),
    ]);

    await Promise.all(
      posts.map(async (post) => {
        if (post.userId?._id?.toString() === req.user._id.toString()) {
          const countedSessions = post.authorOpenStats?.sessionIds || [];

          if (countedSessions.includes(sessionId)) {
            return;
          }

          post.authorOpenStats = {
            count: (post.authorOpenStats?.count || 0) + 1,
            lastOpenedAt: new Date(),
            sessionIds: [...countedSessions, sessionId],
          };
          await post.save();
          return;
        }

        const alreadySeen = post.seenBy.some(
          (id) => id.toString() === req.user._id.toString(),
        );

        if (!alreadySeen) {
          post.seenBy.push(req.user._id);
        }

        const viewEntry = post.viewStats.find(
          (view) => view.userId.toString() === req.user._id.toString(),
        );

        if (viewEntry) {
          const countedSessions = viewEntry.sessionIds || [];

          if (!countedSessions.includes(sessionId)) {
            viewEntry.count += 1;
            viewEntry.lastViewedAt = new Date();
            viewEntry.sessionIds = [...countedSessions, sessionId];
          }
        } else {
          post.viewStats.push({
            userId: req.user._id,
            count: 1,
            firstViewedAt: new Date(),
            lastViewedAt: new Date(),
            sessionIds: [sessionId],
          });
        }

        await post.save();
      }),
    );

    const formattedPosts = posts.map((post) => formatPost(post, req.user._id));

    res.json({
      success: true,
      feedType: scope.feedType,
      group: scope.group
        ? {
            id: scope.group._id,
            name: scope.group.name,
            inviteCode: scope.group.inviteCode,
            memberCount: scope.group.memberCoupleIds.length,
          }
        : null,
      page,
      limit,
      total,
      hasMore: skip + posts.length < total,
      posts: formattedPosts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

PostRouter.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own posts",
      });
    }

    await post.deleteOne();

    return res.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
export default PostRouter;
