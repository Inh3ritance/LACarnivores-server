const faunadb = require('faunadb');
const stripe = require('stripe')(process.env.API_KEY);
const q = faunadb.query;
const adminClient = new faunadb.Client({ 
    secret: process.env.FAUNA,
});

const reviewEndpoints = (router) => {
    router.post('/createReview', async (req, res) => {
        const str = req.body.review_id === undefined ? '0' : req.body.review_id;
        adminClient.query(q.Exists(q.Ref(q.Collection('Reviews'), str)))
        .then(ret => {
            if(!ret) {
                adminClient.query(
                    q.Create(
                        q.Collection('Reviews'),
                        { 
                            data: {
                                users: [req.body.user],
                                reviews: [req.body.review],
                                ratings: [req.body.rating],
                        },
                    })
                )
                .then(async result => {
                    await stripe.products.update(
                        req.body.id,
                        {
                            metadata: {
                                review_id: result.ref.id,
                                ratings: req.body.rating,
                            }
                        }).then(prod => {
                            console.log(prod);
                            res.send("Success");
                        }).catch(err => {
                            console.log(err);
                        });
                }).catch(err => console.log(err));
            } else {
                adminClient.query(q.Get(q.Ref(q.Collection('Reviews'), req.body.review_id)))
                .then(data => {
                    var userArr = data.data.users;
                    userArr.push(req.body.user);
                    var reviewArr = data.data.reviews;
                    reviewArr.push(req.body.review);
                    var rateArr = data.data.ratings;
                    rateArr.push(req.body.rating);
                    adminClient.query(
                        q.Update(q.Ref(q.Collection('Reviews'), req.body.review_id),
                            {
                                data: {
                                    users: userArr,
                                    reviews: reviewArr,
                                    ratings: rateArr,
                                }
                            }
                        )
                    )
                    .then(async result => {
                        console.log(result);
                        await stripe.products.update(
                            req.body.id,
                            {
                                metadata: {
                                    review_id: result.ref.id,
                                    ratings: (rateArr.reduce((a , b) => a + b, 0)/rateArr.length),
                                }
                            }).then(prod => {
                                console.log(prod);
                                res.send("Success");
                            }).catch(err => {
                                console.log(err);
                            });
                    }).catch(err => console.log(err));
                }).catch(err => {
                    console.log(err);
                });
            }
        }).catch(err => console.log(err));
    });

    router.post('/getReviews', (req, res) => {
        if(req.body.review_id !== undefined)
        adminClient.query(q.Exists(q.Ref(q.Collection('Reviews'), req.body.review_id)))
        .then(ret => {
            if(ret) { 
                adminClient.query(
                    q.Get(q.Ref(q.Collection('Reviews'), req.body.review_id))
                ).then(data => {
                    console.log(data.data);
                    res.send(data.data);
                }).catch(err => {
                    console.log(err);
                    res.send(err);
                });
            }   
        }).catch(err => console.log(err));
    });
}

module.exports = {
    reviewEndpoints,
};
