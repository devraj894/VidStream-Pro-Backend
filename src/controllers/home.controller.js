import { Subscription } from "../models/subscription.model";
import { Video } from "../models/video.model";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

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
                            username: 1,
                            fullName: 1,
                            avatar: 1
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
    let [trending, latest, subscriptions] = await Promise.all([
        trendingPromise,
        latestPromise,
        subscriptionsPromise
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
                {title: "Subscriptions", videos: subscriptions}
            ]
        }, "Home feed fetched successfully")
    );
});

export {
    getHomeFeed
}