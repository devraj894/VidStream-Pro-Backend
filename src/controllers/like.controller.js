import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
    // get video id
    const {videoId} = req.params;

    // validate video id
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400, "Invalid video id");
    }

    // find video
    const video = await Video.findById(videoId).select("_id");

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    // find like
    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: req.user._id
    })

    // check if already exists, then delete and return
    if(existingLike){
        await Like.deleteOne({_id: existingLike._id});
        const totalLikes = await Like.countDocuments({video: videoId});
        return res.status(200).json(
            new ApiResponse(
                200, 
                {
                    isLiked: false,
                    totalLikes,
                },
                "Video unliked successfully"
            )
        )
    }

    // otherwise create new one
    await Like.create({
        video: videoId,
        likedBy: req.user._id
    })

    const totalLikes = await Like.countDocuments({video: videoId});

    // return
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                isLiked: true,
                totalLikes
            },
            "Video liked successfully"
        )
    )
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    // get comment id
    const {commentId} = req.params;

    // validate comment id
    if(!mongoose.Types.ObjectId.isValid(commentId)){
        throw new ApiError(400, "Invalid comment id");
    }

    // find comment
    const comment = await Comment.findById(commentId).select("_id");

    if(!comment){
        throw new ApiError(404, "Comment not found");
    }

    // find like
    const existingLike = await Like.findOne({
        comment: commentId,
        likedBy: req.user._id
    })

    // check if already liked, then delete and return
    if(existingLike){
        await Like.deleteOne({_id: existingLike._id});
        const totalLikes = await Like.countDocuments({comment: commentId});
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    isLiked: false,
                    totalLikes
                },
                "Comment unliked successfully"
            )
        )
    }

    // other create new one
    await Like.create({
        comment: commentId,
        likedBy: req.user._id
    })

    const totalLikes = await Like.countDocuments({comment: commentId});

    // return
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                isLiked: true,
                totalLikes
            },
            "Comment liked successfully"
        )
    )
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    // get tweet id
    const {tweetId} = req.params;

    // validate tweet id
    if(!mongoose.Types.ObjectId.isValid(tweetId)){
        throw new ApiError(400, "Invalid tweet id");
    }

    // find tweet
    const tweet = await Tweet.findById(tweetId).select("_id");

    if(!tweet){
        throw new ApiError(404, "Tweet not found");
    }

    // find like
    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user._id
    })

    // check if already liked, then delete and return
    if(existingLike){
        await Like.deleteOne({_id: existingLike._id});
        const totalLikes = await Like.countDocuments({tweet: tweetId});
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    isLiked: false,
                    totalLikes
                },
                "Tweet unliked successfully"
            )
        )
    }

    // other create new one
    await Like.create({
        tweet: tweetId,
        likedBy: req.user._id
    })

    const totalLikes = await Like.countDocuments({tweet: tweetId});

    // return
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                isLiked: true,
                totalLikes
            },
            "Tweet liked successfully"
        )
    )
})

const getLikedVideos = asyncHandler(async (req, res) => {
    // get queries from frontend
    const {page = 1, limit = 10} = req.query;

    // string to number
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // aggregation pipeline
    const aggregate = Like.aggregate([
        {
            // filter current user liked videos (avoid tweet/comment likes)
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user._id),
                video: {$ne: null}
            }
        },
        {
            // sort by Like creation date (recently liked first)
            $sort: {
                createdAt: -1
            }
        },
        {
            // join Video collection
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "video"
            }
        },
        {
            // convert video array into object
            $unwind: "$video"
        },
        {
            // filter only published videos
            $match: {
                "video.isPublished": true
            }
        },
        {
            // replace root to return pure video docs
            $replaceRoot: {
                newRoot: "$video"
            }
        }
    ]);

    // allow plugin to know on which page and how many docs per page
    const options = {
        page: pageNumber,
        limit: limitNumber
    }

    // automatically handle paginated data
    const likedVideos = await Like.aggregatePaginate(aggregate, options);

    // return 
    return res.status(200).json(
        new ApiResponse(
            200,
            likedVideos,
            "Liked videos fetched successfully"
        )
    );
})

export {
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideos
}