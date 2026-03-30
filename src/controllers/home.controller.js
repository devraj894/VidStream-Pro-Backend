import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getHomeFeed = asyncHandler(async (req, res) => {
    // get loggedIn user id
    const userId = req.user._id;

    // date ranges
    const last7days = new Date();
    last7days.setDate(last7days.getDate() - 7);

    // trending (recent + popular)
    const trendingPromise = Video.aggregate([
        {
            $match: {
                isPublished: true,
                createdAt: {
                    $gte: last7days
                }
            }
        },
        {
            $sort: {
                views: -1,
            }
        },
        {
            $limit: 10
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "Owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$Owner"
        }
    ])

    // latest (recent uploaded)
    const latestPromise = Video.aggregate([
        {
            $match: {
                isPublished: true
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "Owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$Owner"
        }
    ]);

    // subscription (only subscribed channel latest videos)
    let subscriptionsPromise = Promise.resolve([]);

    if(userId){
        const channels = await Subscription.find({
            subscriber: userId
        }).distinct("channel");

        subscriptionsPromise = Video.aggregate([
            {
                $match: {
                    isPublished: true,
                    owner: {
                        $in: channels
                    }
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $limit: 10
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "Owner",
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                fullName: 1,
                                avatar: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$Owner"
            }
        ]);
    }

    // recommended(history + creators + keywords)
    let recommendationsPromise = Promise.resolve([]);

    if (userId) {
        const user = await User.findById(userId).populate("watchHistory.video");

        const watchedVideoIds = user.watchHistory
            .map(v => v.video?._id)
            .filter(Boolean);

        const favoriteOwners = user.watchHistory
            .slice(-10)
            .map(v => v.video?.owner)
            .filter(Boolean);

        const lastWatchedTitle = user.watchHistory.at(-1)?.video?.title;

        recommendationsPromise = Video.aggregate([
            {
                $match: {
                    isPublished: true,

                    // own videos remove
                    owner: { 
                        $ne: userId 
                    },

                    // already watched remove
                    _id: { 
                        $nin: watchedVideoIds 
                    },

                    // dynamic OR conditions
                    $or: [
                        ...(favoriteOwners.length
                            ? [{ owner: { $in: favoriteOwners } }]
                            : []),

                        ...(lastWatchedTitle
                            ? [{ title: { $regex: lastWatchedTitle, $options: "i" } }]
                            : [])
                    ]
                }
            },
            { 
                $sort: { 
                    views: -1 
                } 
            },
            { 
                $limit: 10
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "Owner",
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                fullName: 1,
                                avatar: 1
                            }
                        }
                    ]
                }
            },
            { 
                $unwind: "$Owner" 
            }
        ]);
    }

    // parellel execution
    let [trending, latest, subscriptions, recommended] = await Promise.all([
        trendingPromise,
        latestPromise,
        subscriptionsPromise,
        recommendationsPromise
    ]);

    // featured (first data of trending)
    const featured = trending[0] || null;

    // return
    return res.status(200).json(
        new ApiResponse(200, {
            featured,
            sections: [
                {title: "Trending", videos: trending},
                {title: "Latest", videos: latest},
                {title: "Subscriptions", videos: subscriptions},
                {title: "Recommended", videos: recommended}
            ]
        }, "Home feed fetched successfully")
    );
});

export {
    getHomeFeed
}