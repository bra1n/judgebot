function JAR(){
    this.Location = "http://blogs.magicjudges.org/rules/jar/";
    this.find = function(parameter,callback){

    };
}
JAR.prototype.getContent = function(parameter,callback){
    if(parameter){
        this.find(parameter,callback());
    }else{
        callback(this.Location);
    }

};

module.exports = JAR;