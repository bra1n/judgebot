function IPG(){
    this.Location = "http://blogs.magicjudges.org/rules/ipg/";
    this.find = function(parameter,callback){

    };
}
IPG.prototype.getContent = function(parameter,callback){
    if(parameter){
        this.find(parameter,callback());
    }else{
        callback(this.Location);
    }

};

module.exports = IPG;