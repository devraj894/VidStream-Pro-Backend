import { Like } from "../models/like.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
    // get loggedIn userId
    const userId = req.user._id;

    // Video stats (totalVideos + totalViews)
    const videoStatsPromise = Video.aggregate([
        {
            $match: {
                owner: userId,
                isPublished: true
            }
        },
        {
            $group: {
                _id: null,
                totalVideos: { $sum: 1 },
                totalViews: { $sum: "$views" }
            }
        }
    ]);

    // Total Subscribers
    const totalSubscribersPromise = Subscription.countDocuments({
        channel: userId
    });

     // Get all published video IDs of this user
    const videoIdsPromise = Video.find(
        {
            owner: userId,
            isPublished: true
        },
        { _id: 1 }
    ).lean();
    
    // Run videoStats, subscribers & videoIds in parallel
    const [videoStats, totalSubscribers, videoIds] = await Promise.all([
        videoStatsPromise,
        totalSubscribersPromise,
        videoIdsPromise
    ]);

    // Count total video likes
    const totalLikes = await Like.countDocuments({
        video: { $in: videoIds.map(v => v._id) }
    });

    // prepare object for channel stats
    const stats = {
        totalVideos: videoStats[0]?.totalVideos || 0,
        totalViews: videoStats[0]?.totalViews || 0,
        totalSubscribers,
        totalLikes: totalLikes || 0
    };

    // return
    return res.status(200).json(
        new ApiResponse(200, stats, "Channel stats fetched successfully")
    );
});

const getChannelVideos = asyncHandler(async (req, res) => {
    // get loggedIn userId
    const userId = req.user._id;

    // get pagination
    const {page = 1, limit = 10} = req.query;
    
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // filter only required video data based on user id
    const paginate = Video.aggregate([
        {
            $match: {
                owner: userId
            }
        },
        {
            $project: {
                thumbnail: 1,
                title: 1,
                duration: 1,
                views: 1,
                isPublished: 1
            }
        },
        {
            $sort: {createdAt: -1}
        }
    ]);

    // handle pagination
    const options = {
        page: pageNumber,
        limit: limitNumber
    }

    const channelVideos = await Video.aggregatePaginate(paginate, options);

    // return
    return res.status(200).json(
        new ApiResponse(200, channelVideos, "Channel videos fetched successfully")
    )
})

export {
    getChannelStats,
    getChannelVideos
}