import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";

const toggleSubscription = asyncHandler(async (req, res) => {
    // get channel id
    const {channelId} = req.params;

    // validate channel id
    if(!mongoose.Types.ObjectId.isValid(channelId)){
        throw new ApiError(400, "Invalid channel id");
    }

    // check if user is trying to subscribe to themselves
    if(req.user._id.toString() === channelId){
        throw new ApiError(400, "You cannot subscribe to yourself");
    }

    // check if subscription exists
    const subscription = await Subscription.findOne({
        subscriber: req.user._id,
        channel: channelId,
    });

    // if exists, delete subscription and return
    if(subscription){
        await subscription.deleteOne();
        return res.status(200).json(
            new ApiResponse(200, null, "Unsubscribed successfully")
        )
    }

    // if not exists, create subscription and return
    const newSubscription = await Subscription.create({
        subscriber: req.user._id,
        channel: channelId,
    });

    return res.status(201).json(
        new ApiResponse(201, newSubscription, "Subscribed successfully")
    )
})

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    // get channel id
    const {channelId} = req.params;

    // pagination data
    const {page = 1, limit = 10} = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // validate channel id
    if(!mongoose.Types.ObjectId.isValid(channelId)){
        throw new ApiError(400, "Invalid channel id");
    }

    // check if channel exists
    const channelExists = await User.findById(channelId);

    if(!channelExists){
        throw new ApiError(404, "Channel not found");
    }

    // find all subscriptions for the channel
    const aggregate = Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId),
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriberDetails",
            }
        },
        {
            $unwind: "$subscriberDetails",
        },
        {
            $project: {
                _id: "$subscriberDetails._id",
                username: "$subscriberDetails.username",
                fullName: "$subscriberDetails.fullName",
                avatar: "$subscriberDetails.avatar.url",
                subscribedAt: "$createdAt",
            }
        },
        {
            $sort: {
                subscribedAt: -1,
            }
        }
    ])

    // handle pagination
    const options = {
        page: pageNumber,
        limit: limitNumber,
    }

    const subscribers = await Subscription.aggregatePaginate(aggregate, options);

    // return
    return res.status(200).json(
        new ApiResponse(200, subscribers, "Subscribers fetched successfully")
    )
})

const getSubscribedChannels = asyncHandler(async (req, res) => {
    // get subscriber id
    const {subscriberId} = req.params;

    // pagination data
    const {page = 1, limit = 10} = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // validate subscriber id
    if(!mongoose.Types.ObjectId.isValid(subscriberId)){
        throw new ApiError(400, "Invalid subscriber id");
    }

    // check if subscriber exists
    const subscriberExists = await User.findById(subscriberId);

    if(!subscriberExists){
        throw new ApiError(404, "Subscriber not found");
    }

    // find all subscriptions for the subscriber
    const aggregate = Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId),
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channelDetails",
            }
        },
        {
            $unwind: "$channelDetails",
        },
        {
            $project: {
                _id: "$channelDetails._id",
                username: "$channelDetails.username",
                fullName: "$channelDetails.fullName",
                avatar: "$channelDetails.avatar.url",
                subscribedAt: "$createdAt",
            }
        },
        {
            $sort: {
                subscribedAt: -1,
            }
        }
    ])

    // handle pagination
    const options = {
        page: pageNumber,
        limit: limitNumber,
    }

    const subscribedChannels = await Subscription.aggregatePaginate(aggregate, options);

    // return
    return res.status(200).json(
        new ApiResponse(200, subscribedChannels, "Subscribed channels count fetched successfully")
    )
})

export { 
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
};