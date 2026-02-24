import mongoose from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
    // get content
    const {content} = req.body;

    // validate content
    if(!content?.trim()){
        throw new ApiError(400, "Please add content");
    }

    // create tweet
    const tweet = await Tweet.create({
        content: content,
        owner: req.user._id
    })

    // return
    return res.status(201).json(
        new ApiResponse(201, tweet, "Tweet created succussfully")
    )
})

const getUserTweets = asyncHandler(async (req, res) => {
    // get userId
    const userId = req.params.userId || req.user._id;
    const {page = 1, limit = 10} = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // validate userId
    if(!mongoose.Types.ObjectId.isValid(userId)){
        throw new ApiError(400, "Invalid user id");
    }

    // filter tweets bases on userId
    const aggregate = Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $sort: { createdAt: -1 }
        }
    ]);

    // handle pagination 
    const options = {
        page: pageNumber,
        limit: limitNumber
    }

    const paginatedTweets = await Tweet.aggregatePaginate(aggregate, options);

    // return
    return res.status(200).json(
        new ApiResponse(200, paginatedTweets, "Tweets fetched successfully")
    )
})

const updateTweet = asyncHandler(async (req, res) => {
    // get data (tweetId and newContent)
    const {tweetId} = req.params;
    const {newContent} = req.body;

    // validate data
    if(!mongoose.Types.ObjectId.isValid(tweetId)){
        throw new ApiError(400, "Invalid tweet id");
    }

    if(!newContent?.trim()){
        throw new ApiError(400, "Please update new content for tweet");
    }

    // check tweet exists and authorization to update
    const tweet = await Tweet.findOneAndUpdate(
        {
            _id: tweetId,
            owner: req.user._id,
        },
        {
            $set: {
                content: newContent.trim()
            }
        },
        {
            new: true
        }
    );

    if(!tweet){
        throw new ApiError(404, "Tweet not found or you are not allowed to update the tweet");
    }
    
    // return
    return res.status(200).json(
        new ApiResponse(200, tweet, "Tweet updated successfully")
    )
})

const deleteTweet =  asyncHandler(async (req, res) => {
    // get tweetId
    const {tweetId} = req.params;

    // validate tweetId
    if(!mongoose.Types.ObjectId.isValid(tweetId)){
        throw new ApiError(400, "Invalid tweet id");
    }

    // check tweet exists and authorization to delete
    const tweet = await Tweet.findOneAndDelete(
        {
            _id: tweetId,
            owner: req.user._id
        },
    )

    if(!tweet){
        throw new ApiError(404, "Tweet not found or you are not allowed to delete tweet");
    }

    // return
    return res.status(200).json(
        new ApiResponse(200, null, "Tweet deleted successfully")
    )
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}