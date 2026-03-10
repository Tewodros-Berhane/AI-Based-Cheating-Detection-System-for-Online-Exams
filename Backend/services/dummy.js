
let getdomain = async(req,res,next)=>{
    var testid='1234';
    var userid='7899';
    res.json({url:`${req.protocol + '://' + req.get('host')}/examinee/taketest?testid=${testid}&examineeid=${userid}`});
}
module.exports = {getdomain};

